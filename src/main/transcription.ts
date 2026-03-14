import { app } from 'electron';
import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';
import { promisify } from 'util';
import { execFile } from 'child_process';

const execFileAsync = promisify(execFile);

export interface TranscriptionResult {
  success: boolean;
  text?: string;
  error?: string;
  provider: 'whisper.cpp' | 'openai' | 'local' | 'none';
  duration?: number;
}

export interface TranscriptionConfig {
  whisperCppPath?: string;
  whisperModelPath?: string;
  openaiApiKey?: string;
  language?: string;
  useLocalFirst: boolean;
}

/**
 * TranscriptionService - Handles audio-to-text transcription
 * 
 * Supports:
 * - whisper.cpp (local, preferred)
 * - OpenAI Whisper API (cloud fallback)
 * - Structured placeholder for missing dependencies
 */
export class TranscriptionService {
  private config: TranscriptionConfig;
  private whisperAvailable: boolean | null = null;
  private modelAvailable: boolean | null = null;

  constructor(config: TranscriptionConfig) {
    this.config = {
      language: 'en',
      ...config
    };
  }

  /**
   * Check system capabilities and return status
   */
  async getStatus(): Promise<{
    whisperInstalled: boolean;
    modelAvailable: boolean;
    whisperPath?: string;
    modelPath?: string;
    recommendations: string[];
  }> {
    const recommendations: string[] = [];
    
    // Check whisper.cpp
    const whisperInstalled = await this.checkWhisper();
    const whisperPath = this.findWhisperPath();
    
    // Check model
    const modelPath = this.findModelPath();
    const hasModel = modelPath ? fs.existsSync(modelPath) : false;
    
    if (!whisperInstalled) {
      recommendations.push(
        'Install whisper.cpp for local transcription:',
        '  brew install whisper.cpp',
        '  OR build from source: https://github.com/ggerganov/whisper.cpp'
      );
    }
    
    if (!hasModel) {
      recommendations.push(
        'Download a Whisper model (~100MB for base, ~500MB for small):',
        '  curl -L -o models/ggml-base.bin https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin',
        'Available models: tiny (39MB), base (74MB), small (466MB), medium (1.5GB), large (3.1GB)'
      );
    }

    return {
      whisperInstalled,
      modelAvailable: hasModel,
      whisperPath: whisperPath || undefined,
      modelPath: hasModel ? (modelPath || undefined) : undefined,
      recommendations
    };
  }

  /**
   * Transcribe audio file to text
   */
  async transcribe(audioPath: string): Promise<TranscriptionResult> {
    const startTime = Date.now();
    
    // Check if file exists and has content
    if (!fs.existsSync(audioPath)) {
      return {
        success: false,
        error: 'Audio file not found',
        provider: 'none'
      };
    }
    
    const stats = fs.statSync(audioPath);
    if (stats.size === 0) {
      return {
        success: false,
        error: 'Audio file is empty (ffmpeg may not be available)',
        provider: 'none'
      };
    }

    // Try whisper.cpp first if configured
    if (this.config.useLocalFirst) {
      const localResult = await this.transcribeWithWhisperCpp(audioPath);
      if (localResult.success) {
        return {
          ...localResult,
          duration: Date.now() - startTime
        };
      }
      console.log('[Transcription] Local whisper.cpp failed, falling back:', localResult.error);
    }

    // Try OpenAI API if configured
    if (this.config.openaiApiKey) {
      const openaiResult = await this.transcribeWithOpenAI(audioPath);
      if (openaiResult.success) {
        return {
          ...openaiResult,
          duration: Date.now() - startTime
        };
      }
    }

    // Return structured failure with guidance
    return this.createPlaceholderResult(audioPath);
  }

  /**
   * Transcribe using local whisper.cpp
   */
  private async transcribeWithWhisperCpp(audioPath: string): Promise<TranscriptionResult> {
    const whisperPath = this.findWhisperPath();
    const modelPath = this.findModelPath();

    if (!whisperPath) {
      return {
        success: false,
        error: 'whisper.cpp not found. Install with: brew install whisper.cpp',
        provider: 'whisper.cpp'
      };
    }

    if (!modelPath || !fs.existsSync(modelPath)) {
      return {
        success: false,
        error: 'Whisper model not found. Download with instructions in README.',
        provider: 'whisper.cpp'
      };
    }

    try {
      console.log(`[Transcription] Running whisper.cpp: ${whisperPath}`);
      console.log(`[Transcription] Model: ${modelPath}`);
      console.log(`[Transcription] Audio: ${audioPath}`);

      // Create temp output file
      const outputDir = path.dirname(audioPath);
      const outputFile = path.join(outputDir, `transcription_${Date.now()}.txt`);

      // Run whisper.cpp
      // -f: input file
      // -m: model path
      // -l: language
      // -otxt: output as text
      // -of: output file (without extension)
      // -np: no progress bar
      const args = [
        '-f', audioPath,
        '-m', modelPath,
        '-l', this.config.language || 'en',
        '-otxt', 'true',
        '-of', outputFile.replace('.txt', ''),
        '-np'
      ];

      const { stdout, stderr } = await execFileAsync(whisperPath, args, {
        timeout: 60000, // 60 second timeout
        encoding: 'utf8'
      });

      // Read the output file
      const resultFile = outputFile.replace('.txt', '.txt');
      if (fs.existsSync(resultFile)) {
        const text = fs.readFileSync(resultFile, 'utf8').trim();
        
        // Clean up output file
        try {
          fs.unlinkSync(resultFile);
        } catch {}

        if (text) {
          return {
            success: true,
            text,
            provider: 'whisper.cpp'
          };
        }
      }

      // Fallback: parse stdout
      const text = this.parseWhisperOutput(stdout || stderr || '');
      if (text) {
        return {
          success: true,
          text,
          provider: 'whisper.cpp'
        };
      }

      return {
        success: false,
        error: 'No transcription output from whisper.cpp',
        provider: 'whisper.cpp'
      };
    } catch (error: any) {
      const errorMsg = error?.message || 'Unknown whisper.cpp error';
      console.error('[Transcription] whisper.cpp failed:', errorMsg);
      
      return {
        success: false,
        error: `whisper.cpp failed: ${errorMsg}`,
        provider: 'whisper.cpp'
      };
    }
  }

  /**
   * Transcribe using OpenAI API
   */
  private async transcribeWithOpenAI(audioPath: string): Promise<TranscriptionResult> {
    if (!this.config.openaiApiKey) {
      return {
        success: false,
        error: 'OpenAI API key not configured',
        provider: 'openai'
      };
    }

    try {
      const FormData = (await import('form-data')).default;
      const fs = await import('fs');
      const fetch = (await import('node-fetch')).default;
      
      const formData = new FormData();
      formData.append('file', fs.createReadStream(audioPath));
      formData.append('model', 'whisper-1');
      formData.append('language', this.config.language || 'en');

      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.openaiApiKey}`,
          ...formData.getHeaders()
        },
        body: formData
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`OpenAI API error: ${error}`);
      }

      const data = await response.json() as { text: string };
      
      return {
        success: true,
        text: data.text,
        provider: 'openai'
      };
    } catch (error: any) {
      return {
        success: false,
        error: error?.message || 'OpenAI transcription failed',
        provider: 'openai'
      };
    }
  }

  /**
   * Create a placeholder result with setup instructions
   */
  private createPlaceholderResult(audioPath: string): TranscriptionResult {
    const status = this.getQuickStatus();
    
    let text = '[Transcription unavailable - ';
    
    if (!status.whisperInstalled && !this.config.openaiApiKey) {
      text += 'No transcription provider configured]\n\n';
      text += 'To enable dictation:\n';
      text += '1. Install whisper.cpp: brew install whisper.cpp\n';
      text += '2. Download a model (see README)\n';
      text += '3. Or configure OpenAI API key in settings';
    } else if (!status.modelAvailable) {
      text += 'Whisper model not found]\n\n';
      text += 'Download a model to enable transcription:\n';
      text += 'curl -L -o models/ggml-base.bin https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin';
    } else {
      text += 'Transcription failed - check logs for details]';
    }

    return {
      success: false,
      text,
      error: 'Transcription provider not available',
      provider: 'none'
    };
  }

  /**
   * Find whisper.cpp binary in common locations
   */
  private findWhisperPath(): string | null {
    if (this.config.whisperCppPath && fs.existsSync(this.config.whisperCppPath)) {
      return this.config.whisperCppPath;
    }

    const candidates = [
      '/opt/homebrew/bin/whisper-cpp',
      '/usr/local/bin/whisper-cpp',
      '/opt/homebrew/bin/whisper',
      '/usr/local/bin/whisper',
      path.join(process.env.HOME || '', '.local/bin/whisper-cpp'),
      path.join(process.env.HOME || '', '.local/bin/whisper'),
    ];

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }

    return null;
  }

  /**
   * Find whisper model in common locations
   */
  private findModelPath(): string | null {
    if (this.config.whisperModelPath && fs.existsSync(this.config.whisperModelPath)) {
      return this.config.whisperModelPath;
    }

    const modelDir = path.join(app.getPath('userData'), 'models');
    const candidates = [
      path.join(modelDir, 'ggml-base.bin'),
      path.join(modelDir, 'ggml-small.bin'),
      path.join(modelDir, 'ggml-tiny.bin'),
      path.join(modelDir, 'ggml-medium.bin'),
      '/opt/homebrew/share/whisper.cpp/ggml-base.bin',
      '/usr/local/share/whisper.cpp/ggml-base.bin',
      path.join(process.env.HOME || '', '.local/share/whisper.cpp/ggml-base.bin'),
    ];

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }

    return null;
  }

  /**
   * Check if whisper is available
   */
  private async checkWhisper(): Promise<boolean> {
    if (this.whisperAvailable !== null) return this.whisperAvailable;
    
    const whisperPath = this.findWhisperPath();
    if (!whisperPath) {
      this.whisperAvailable = false;
      return false;
    }

    try {
      await execFileAsync(whisperPath, ['--help']);
      this.whisperAvailable = true;
      return true;
    } catch {
      this.whisperAvailable = false;
      return false;
    }
  }

  /**
   * Get quick status without full check
   */
  private getQuickStatus(): { whisperInstalled: boolean; modelAvailable: boolean } {
    return {
      whisperInstalled: !!this.findWhisperPath(),
      modelAvailable: !!this.findModelPath()
    };
  }

  /**
   * Parse whisper.cpp output to extract text
   */
  private parseWhisperOutput(output: string): string | null {
    const lines = output.split('\n');
    const texts: string[] = [];
    
    for (const line of lines) {
      // Skip lines that look like metadata/timestamps
      if (line.match(/^\[\d{2}:\d{2}:\d{2}\.\d{3} --> \d{2}:\d{2}:\d{2}\.\d{3}\]/)) {
        continue;
      }
      // Skip empty lines and headers
      if (!line.trim() || line.includes('whisper') || line.includes('model')) {
        continue;
      }
      texts.push(line.trim());
    }
    
    return texts.length > 0 ? texts.join(' ') : null;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<TranscriptionConfig>): void {
    this.config = { ...this.config, ...config };
    // Reset cached availability
    this.whisperAvailable = null;
    this.modelAvailable = null;
  }
}
