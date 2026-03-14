import { app } from 'electron';
import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';
import { promisify } from 'util';
import { execFile } from 'child_process';

const execFileAsync = promisify(execFile);

export type CloudProviderType = 'openai' | 'groq' | 'anthropic' | 'deepseek' | 'zhipu' | 'minimax' | 'moonshot';

export interface CloudProviderConfig {
  id: CloudProviderType;
  name: string;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  enabled: boolean;
}

export interface TranscriptionStatus {
  whisperInstalled: boolean;
  modelAvailable: boolean;
  whisperPath?: string;
  modelPath?: string;
  recommendations: string[];
  hasCloudProvider: boolean;
  activeProvider?: string;
  cloudProviderType?: CloudProviderType;
}

export interface TranscriptionResult {
  success: boolean;
  text?: string;
  error?: string;
  provider: 'whisper.cpp' | 'openai' | 'groq' | 'anthropic' | 'deepseek' | 'zhipu' | 'minimax' | 'moonshot' | 'local' | 'none';
  duration?: number;
  fallbackToClipboard?: boolean;
}

export interface TranscriptionConfig {
  whisperCppPath?: string;
  whisperModelPath?: string;
  language?: string;
  useLocalFirst: boolean;
  cloudProviders?: CloudProviderConfig[];
  preferredProvider?: 'local' | 'cloud' | 'auto';
  // Legacy OpenAI key support for backward compatibility
  openaiApiKey?: string;
}

/**
 * TranscriptionService - Handles audio-to-text transcription
 * 
 * Supports:
 * - whisper.cpp (local, preferred)
 * - OpenAI Whisper API (cloud fallback)
 * - Groq Whisper API (cloud fallback)
 * - Other OpenAI-compatible providers
 * - Structured placeholder for missing dependencies
 */
export class TranscriptionService {
  private config: TranscriptionConfig;
  private whisperAvailable: boolean | null = null;
  private modelAvailable: boolean | null = null;

  constructor(config: TranscriptionConfig) {
    this.config = {
      language: 'en',
      cloudProviders: [],
      ...config
    };
  }

  /**
   * Get the active cloud provider (first enabled one in priority order)
   */
  private getActiveCloudProvider(): CloudProviderConfig | null {
    const providers = this.config.cloudProviders || [];
    
    // Filter enabled providers with API keys
    const enabledProviders = providers.filter(p => p.enabled && p.apiKey);
    
    if (enabledProviders.length === 0) {
      // Legacy fallback: check for openaiApiKey directly
      if (this.config.openaiApiKey) {
        return {
          id: 'openai',
          name: 'OpenAI',
          apiKey: this.config.openaiApiKey,
          enabled: true
        };
      }
      return null;
    }
    
    // Return first enabled provider (priority order)
    return enabledProviders[0];
  }

  /**
   * Check system capabilities and return status
   */
  async getStatus(cloudProviders?: CloudProviderConfig[]): Promise<TranscriptionStatus> {
    const recommendations: string[] = [];
    
    // Check whisper.cpp
    const whisperInstalled = await this.checkWhisper();
    const whisperPath = this.findWhisperPath();
    
    // Check model
    const modelPath = this.findModelPath();
    const hasModel = modelPath ? fs.existsSync(modelPath) : false;
    
    // Check cloud providers
    const providersToCheck = cloudProviders || this.config.cloudProviders || [];
    const activeCloudProvider = providersToCheck.find(p => p.enabled && p.apiKey);
    const hasCloudProvider = !!activeCloudProvider || !!this.config.openaiApiKey;
    
    // Determine active provider based on preference
    let activeProvider: string | undefined;
    let cloudProviderType: CloudProviderType | undefined;
    
    const preferred = this.config.preferredProvider || 'auto';
    
    if (preferred === 'local' && whisperInstalled && hasModel) {
      activeProvider = 'whisper.cpp';
    } else if (preferred === 'cloud' && activeCloudProvider) {
      activeProvider = activeCloudProvider.name;
      cloudProviderType = activeCloudProvider.id;
    } else if (preferred === 'cloud' && this.config.openaiApiKey) {
      activeProvider = 'OpenAI';
      cloudProviderType = 'openai';
    } else if (preferred === 'auto') {
      // Auto mode: prefer local if available, fallback to cloud
      if (whisperInstalled && hasModel) {
        activeProvider = 'whisper.cpp';
      } else if (activeCloudProvider) {
        activeProvider = activeCloudProvider.name;
        cloudProviderType = activeCloudProvider.id;
      } else if (this.config.openaiApiKey) {
        activeProvider = 'OpenAI';
        cloudProviderType = 'openai';
      }
    } else if (whisperInstalled && hasModel) {
      // Fallback for invalid preference
      activeProvider = 'whisper.cpp';
    } else if (activeCloudProvider) {
      activeProvider = activeCloudProvider.name;
      cloudProviderType = activeCloudProvider.id;
    }

    if (!whisperInstalled) {
      recommendations.push(
        'Install whisper.cpp for local transcription:',
        '  brew install whisper.cpp'
      );
    }
    
    if (!hasModel) {
      recommendations.push(
        'Download a Whisper model (~74MB for base):',
        '  curl -L -o ~/Library/Application\ Support/OpenType/models/ggml-base.bin https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin'
      );
    }
    
    if (!whisperInstalled && !hasCloudProvider) {
      recommendations.push(
        'Or configure a cloud provider (OpenAI, Groq, etc.) in Settings for cloud transcription'
      );
    }

    return {
      whisperInstalled,
      modelAvailable: hasModel,
      whisperPath: whisperPath || undefined,
      modelPath: hasModel ? (modelPath || undefined) : undefined,
      recommendations,
      hasCloudProvider,
      activeProvider,
      cloudProviderType
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

    // Track errors for debugging
    const errors: string[] = [];

    // Try whisper.cpp first if configured
    if (this.config.useLocalFirst) {
      try {
        const localResult = await this.transcribeWithWhisperCpp(audioPath);
        if (localResult.success) {
          return {
            ...localResult,
            duration: Date.now() - startTime
          };
        }
        errors.push(`whisper.cpp: ${localResult.error}`);
        console.log('[Transcription] Local whisper.cpp failed, falling back:', localResult.error);
      } catch (error: any) {
        const errorMsg = error?.message || 'Unknown whisper.cpp error';
        errors.push(`whisper.cpp exception: ${errorMsg}`);
        console.error('[Transcription] whisper.cpp threw exception:', errorMsg);
      }
    }

    // Try cloud providers in priority order
    const cloudProvider = this.getActiveCloudProvider();
    if (cloudProvider) {
      try {
        const cloudResult = await this.transcribeWithCloudProvider(audioPath, cloudProvider);
        if (cloudResult.success) {
          return {
            ...cloudResult,
            duration: Date.now() - startTime
          };
        }
        errors.push(`${cloudProvider.name}: ${cloudResult.error}`);
      } catch (error: any) {
        const errorMsg = error?.message || `Unknown ${cloudProvider.name} error`;
        errors.push(`${cloudProvider.name} exception: ${errorMsg}`);
        console.error(`[Transcription] ${cloudProvider.name} threw exception:`, errorMsg);
      }
    }

    // Return structured failure with guidance
    return this.createPlaceholderResult(audioPath, errors);
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
        provider: 'local'
      };
    }

    if (!modelPath || !fs.existsSync(modelPath)) {
      return {
        success: false,
        error: 'Whisper model not found. Download with instructions in README.',
        provider: 'local'
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
      // -otxt: output as text (flag, no value)
      // -of: output file (without extension)
      // -np: no progress bar (flag, no value)
      const args = [
        '-f', audioPath,
        '-m', modelPath,
        '-l', this.config.language || 'en',
        '-otxt',
        '-of', outputFile.replace('.txt', ''),
        '-np'
      ];

      const { stdout, stderr } = await execFileAsync(whisperPath, args, {
        timeout: 120000, // 120 second timeout for larger files
        encoding: 'utf8',
        maxBuffer: 10 * 1024 * 1024 // 10MB buffer
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
   * Transcribe using a cloud provider (OpenAI, Groq, etc.)
   */
  private async transcribeWithCloudProvider(
    audioPath: string, 
    provider: CloudProviderConfig
  ): Promise<TranscriptionResult> {
    if (!provider.apiKey) {
      return {
        success: false,
        error: `${provider.name} API key not configured`,
        provider: provider.id
      };
    }

    try {
      const FormData = (await import('form-data')).default;
      const fs = await import('fs');
      const fetch = (await import('node-fetch')).default;
      
      const formData = new FormData();
      formData.append('file', fs.createReadStream(audioPath));
      
      // Determine model and endpoint based on provider
      let endpoint: string;
      let model: string;
      
      switch (provider.id) {
        case 'groq':
          endpoint = provider.baseUrl || 'https://api.groq.com/openai/v1/audio/transcriptions';
          model = provider.model || 'whisper-large-v3';
          break;
        case 'openai':
        default:
          endpoint = provider.baseUrl || 'https://api.openai.com/v1/audio/transcriptions';
          model = provider.model || 'whisper-1';
          break;
      }
      
      formData.append('model', model);
      formData.append('language', this.config.language || 'en');
      
      // Groq doesn't support response_format parameter, so we keep it minimal

      console.log(`[Transcription] Using ${provider.name} API at ${endpoint}`);

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${provider.apiKey}`,
          ...formData.getHeaders()
        },
        body: formData
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage: string;
        
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.error?.message || errorJson.message || errorText;
        } catch {
          errorMessage = errorText || `HTTP ${response.status}`;
        }
        
        throw new Error(`${provider.name} API error: ${errorMessage}`);
      }

      const data = await response.json() as { text: string };
      
      if (!data.text) {
        return {
          success: false,
          error: `${provider.name} returned empty transcription`,
          provider: provider.id
        };
      }
      
      return {
        success: true,
        text: data.text,
        provider: provider.id
      };
    } catch (error: any) {
      const errorMsg = error?.message || `${provider.name} transcription failed`;
      console.error(`[Transcription] ${provider.name} failed:`, errorMsg);
      
      return {
        success: false,
        error: errorMsg,
        provider: provider.id
      };
    }
  }

  /**
   * Legacy: Transcribe using OpenAI API (maintained for backward compatibility)
   */
  private async transcribeWithOpenAI(audioPath: string): Promise<TranscriptionResult> {
    if (!this.config.openaiApiKey) {
      return {
        success: false,
        error: 'OpenAI API key not configured',
        provider: 'openai'
      };
    }

    const provider: CloudProviderConfig = {
      id: 'openai',
      name: 'OpenAI',
      apiKey: this.config.openaiApiKey,
      enabled: true
    };

    return this.transcribeWithCloudProvider(audioPath, provider);
  }

  /**
   * Create a placeholder result with setup instructions
   */
  private createPlaceholderResult(audioPath: string, errors?: string[]): TranscriptionResult {
    const status = this.getQuickStatus();
    const hasCloudConfig = this.getActiveCloudProvider() !== null;
    
    let text = '[Transcription unavailable - ';
    
    if (!status.whisperInstalled && !hasCloudConfig && !this.config.openaiApiKey) {
      text += 'No transcription provider configured]\n\n';
      text += 'To enable dictation:\n';
      text += '1. Install whisper.cpp: brew install whisper.cpp\n';
      text += '2. Download a model (see README)\n';
      text += '3. Or configure a cloud provider (OpenAI, Groq, etc.) in settings';
    } else if (!status.modelAvailable && status.whisperInstalled) {
      text += 'Whisper model not found]\n\n';
      text += 'Download a model to enable transcription:\n';
      text += 'curl -L -o models/ggml-base.bin https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin';
    } else {
      text += 'All transcription providers failed]';
      if (errors && errors.length > 0) {
        text += '\n\nErrors:\n' + errors.map(e => `- ${e}`).join('\n');
      }
    }

    return {
      success: false,
      text,
      error: errors?.join('; ') || 'Transcription provider not available',
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
      const trimmed = line.trim();
      // Skip lines that look like metadata/timestamps
      if (line.match(/^\[\d{2}:\d{2}:\d{2}\.\d{3} --> \d{2}:\d{2}:\d{2}\.\d{3}\]/)) {
        continue;
      }
      // Skip empty lines and log messages
      if (!trimmed || 
          trimmed.includes('whisper') || 
          trimmed.includes('model') ||
          trimmed.includes('output_txt:') ||
          trimmed.includes('saving output to') ||
          trimmed.startsWith('[') && trimmed.includes(']')) {
        continue;
      }
      texts.push(trimmed);
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