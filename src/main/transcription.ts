import { app } from 'electron';
import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';
import { promisify } from 'util';
import { execFile } from 'child_process';
import crypto from 'crypto';

const execFileAsync = promisify(execFile);

export type CloudProviderType = 'openai' | 'groq' | 'anthropic' | 'deepseek' | 'zhipu' | 'minimax' | 'moonshot' | 'aliyun-asr' | 'tencent-asr' | 'baidu-asr' | 'iflytek-asr';

export interface CloudProviderConfig {
  id: CloudProviderType;
  name: string;
  apiKey?: string;
  credentials?: Record<string, string>; // For providers needing multiple credentials (e.g., accessKeyId, accessKeySecret)
  baseUrl?: string;
  model?: string;
  enabled: boolean;
  region?: string; // For region-specific providers like Alibaba Cloud
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

export interface ModelInfo {
  name: string;
  path: string;
  size: number;
  exists: boolean;
}

export interface TranscriptionResult {
  success: boolean;
  text?: string;
  error?: string;
  provider: 'whisper.cpp' | 'openai' | 'groq' | 'anthropic' | 'deepseek' | 'zhipu' | 'minimax' | 'moonshot' | 'aliyun-asr' | 'tencent-asr' | 'baidu-asr' | 'iflytek-asr' | 'local' | 'none';
  duration?: number;
  fallbackToClipboard?: boolean;
  fallbackUsed?: boolean;
  fallbackFrom?: string;
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
   * Implements fallback chain: preferred provider -> other cloud providers -> local
   */
  async transcribe(audioPath: string, options?: { preferredProvider?: string; enableFallback?: boolean }): Promise<TranscriptionResult> {
    const startTime = Date.now();
    const enableFallback = options?.enableFallback ?? true;
    const preferredProviderId = options?.preferredProvider;

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

    // Build provider chain
    const providerChain = this.buildProviderChain(preferredProviderId, enableFallback);

    // Track errors and attempts
    const errors: Array<{ provider: string; error: string }> = [];
    let fallbackFrom: string | undefined;

    // Try each provider in the chain
    for (const provider of providerChain.slice(0, 3)) { // Max 3 attempts
      try {
        let result: TranscriptionResult;

        if (provider.id === 'local' || provider.id === 'whisper.cpp') {
          result = await this.transcribeWithWhisperCpp(audioPath);
        } else if (provider.id === 'aliyun-asr') {
          result = await this.transcribeWithAliyunASR(audioPath, provider as CloudProviderConfig);
        } else {
          result = await this.transcribeWithCloudProvider(audioPath, provider as CloudProviderConfig);
        }

        if (result.success) {
          return {
            ...result,
            duration: Date.now() - startTime,
            fallbackUsed: !!fallbackFrom,
            fallbackFrom
          };
        }

        // Track error and continue to next provider
        errors.push({ provider: provider.name || provider.id, error: result.error || 'Unknown error' });
        if (!fallbackFrom) {
          fallbackFrom = provider.name || provider.id;
        }

        console.log(`[Transcription] ${provider.name || provider.id} failed, trying next:`, result.error);
      } catch (error: any) {
        const errorMsg = error?.message || `Unknown ${provider.name || provider.id} error`;
        errors.push({ provider: provider.name || provider.id, error: errorMsg });
        console.error(`[Transcription] ${provider.name || provider.id} threw exception:`, errorMsg);

        if (!fallbackFrom) {
          fallbackFrom = provider.name || provider.id;
        }
      }
    }

    // Return comprehensive error with all attempts
    return this.createPlaceholderResult(audioPath, errors.map(e => `${e.provider}: ${e.error}`));
  }

  /**
   * Build the provider chain for fallback
   */
  private buildProviderChain(preferredProviderId?: string, enableFallback: boolean = true): Array<CloudProviderConfig | { id: string; name: string }> {
    const chain: Array<CloudProviderConfig | { id: string; name: string }> = [];
    const cloudProviders = this.config.cloudProviders || [];

    // If a specific provider is preferred and fallback is disabled, only use that provider
    if (preferredProviderId && !enableFallback) {
      if (preferredProviderId === 'local' || preferredProviderId === 'whisper.cpp') {
        return [{ id: 'local', name: 'Local whisper.cpp' }];
      }
      const provider = cloudProviders.find(p => p.id === preferredProviderId && p.enabled);
      if (provider) {
        return [provider];
      }
    }

    // Add preferred provider first
    if (preferredProviderId) {
      if (preferredProviderId === 'local' || preferredProviderId === 'whisper.cpp') {
        chain.push({ id: 'local', name: 'Local whisper.cpp' });
      } else {
        const provider = cloudProviders.find(p => p.id === preferredProviderId && p.enabled);
        if (provider) {
          chain.push(provider);
        }
      }
    }

    if (!enableFallback) {
      return chain;
    }

    // Add other enabled cloud providers (excluding already added)
    const enabledCloudProviders = cloudProviders.filter(
      p => p.enabled && p.id !== preferredProviderId && (p.apiKey || p.credentials)
    );
    chain.push(...enabledCloudProviders);

    // Add local whisper.cpp as last resort (if not already added)
    if (preferredProviderId !== 'local' && preferredProviderId !== 'whisper.cpp') {
      chain.push({ id: 'local', name: 'Local whisper.cpp' });
    }

    return chain;
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
   * Transcribe using Alibaba Cloud ASR
   */
  private async transcribeWithAliyunASR(
    audioPath: string,
    provider: CloudProviderConfig
  ): Promise<TranscriptionResult> {
    const credentials = provider.credentials;
    if (!credentials?.accessKeyId || !credentials?.accessKeySecret) {
      return {
        success: false,
        error: 'Alibaba Cloud ASR requires AccessKey ID and AccessKey Secret',
        provider: 'aliyun-asr'
      };
    }

    try {
      // Convert audio to PCM 16kHz 16-bit mono format required by Alibaba Cloud
      const pcmPath = await this.convertToPcmFormat(audioPath);

      // Read audio file as base64
      const audioBase64 = fs.readFileSync(pcmPath).toString('base64');

      // Clean up temp file
      try {
        fs.unlinkSync(pcmPath);
      } catch {}

      // Build request parameters
      const region = provider.region || 'cn-shanghai';
      const endpoint = provider.baseUrl || `https://nls-gateway-${region}.aliyuncs.com/stream/v1/asr`;

      // Use pop-style API (simpler for file-based recognition)
      const popEndpoint = 'https://nls-meta.cn-shanghai.aliyuncs.com';
      const apiPath = '/rest/2022-12/14/asr';

      // Create request body
      const requestBody = {
        payload: {
          audio_base64: audioBase64,
          audio_format: 'pcm',
          sample_rate: 16000,
          enable_punctuation_prediction: true,
          enable_inverse_text_normalization: true
        },
        context: {
          device_id: 'opentype-client'
        }
      };

      // Generate signature for Alibaba Cloud POP API
      const signature = this.generateAliyunSignature(
        credentials.accessKeyId,
        credentials.accessKeySecret,
        'POST',
        apiPath,
        requestBody
      );

      const fetch = (await import('node-fetch')).default;

      const response = await fetch(`${popEndpoint}${apiPath}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `acs ${credentials.accessKeyId}:${signature}`
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage: string;
        let errorCode: string | undefined;

        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.message || errorText;
          errorCode = errorJson.code;
        } catch {
          errorMessage = errorText || `HTTP ${response.status}`;
        }

        // Handle specific Alibaba Cloud error codes
        if (errorCode === 'InvalidAccessKeyId.NotFound' || errorCode === 'SignatureDoesNotMatch') {
          return {
            success: false,
            error: `Alibaba Cloud authentication failed: ${errorMessage}. Please check your AccessKey ID and Secret.`,
            provider: 'aliyun-asr'
          };
        }

        if (errorCode === 'QuotaExceeded') {
          return {
            success: false,
            error: `Alibaba Cloud quota exceeded: ${errorMessage}. Please check your console for quota limits.`,
            provider: 'aliyun-asr'
          };
        }

        throw new Error(`Alibaba Cloud ASR error: ${errorMessage}`);
      }

      const data = await response.json() as {
        payload?: {
          result?: string;
          words?: Array<{ text: string; beginTime: number; endTime: number }>;
        };
      };

      const transcribedText = data.payload?.result;

      if (!transcribedText) {
        return {
          success: false,
          error: 'Alibaba Cloud ASR returned empty transcription',
          provider: 'aliyun-asr'
        };
      }

      return {
        success: true,
        text: transcribedText,
        provider: 'aliyun-asr'
      };
    } catch (error: any) {
      const errorMsg = error?.message || 'Alibaba Cloud ASR transcription failed';
      console.error('[Transcription] Alibaba Cloud ASR failed:', errorMsg);

      return {
        success: false,
        error: errorMsg,
        provider: 'aliyun-asr'
      };
    }
  }

  /**
   * Convert audio to PCM 16kHz 16-bit mono format using ffmpeg
   */
  private async convertToPcmFormat(audioPath: string): Promise<string> {
    const outputPath = audioPath.replace(/\.[^/.]+$/, '') + '_16k_pcm.wav';

    try {
      await execFileAsync('ffmpeg', [
        '-i', audioPath,
        '-ar', '16000',      // Sample rate: 16kHz
        '-ac', '1',          // Channels: mono
        '-acodec', 'pcm_s16le', // Codec: PCM 16-bit little-endian
        '-y',                // Overwrite output file
        outputPath
      ], {
        timeout: 30000
      });

      return outputPath;
    } catch (error: any) {
      console.error('[Transcription] Failed to convert audio to PCM:', error);
      throw new Error(`Audio format conversion failed: ${error?.message || 'Unknown error'}`);
    }
  }

  /**
   * Generate HMAC-SHA1 signature for Alibaba Cloud API
   */
  private generateAliyunSignature(
    accessKeyId: string,
    accessKeySecret: string,
    method: string,
    path: string,
    body: object,
    timestamp?: string
  ): string {
    const date = timestamp || new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

    // Create canonical request
    const canonicalRequest = `${method}\n${path}\n\n${JSON.stringify(body)}`;

    // Create string to sign
    const stringToSign = `ACS3-HMAC-SHA256\n${date}\n${canonicalRequest}`;

    // Generate signature using HMAC-SHA256
    const signature = crypto
      .createHmac('sha256', accessKeySecret)
      .update(stringToSign)
      .digest('base64');

    return signature;
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
    const cloudProviders = this.config.cloudProviders || [];
    const hasCloudConfig = cloudProviders.some(p => p.enabled && (p.apiKey || p.credentials));

    let text = '[Transcription unavailable - ';

    if (!status.whisperInstalled && !hasCloudConfig && !this.config.openaiApiKey) {
      text += 'No transcription provider configured]\n\n';
      text += 'To enable dictation:\n';
      text += '1. Install whisper.cpp: brew install whisper.cpp\n';
      text += '2. Download a model (see README)\n';
      text += '3. Or configure a cloud provider (OpenAI, Alibaba Cloud, etc.) in settings';
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
   * List all whisper.cpp models found in common locations.
   */
  listLocalModels(): ModelInfo[] {
    const modelDirs = [
      path.join(app.getPath('userData'), 'models'),
      path.join(process.env.HOME || '', 'Library', 'Application Support', 'OpenType', 'models'),
      '/opt/homebrew/share/whisper.cpp',
      '/usr/local/share/whisper.cpp',
      path.join(process.env.HOME || '', '.local', 'share', 'whisper.cpp'),
    ];

    const results: ModelInfo[] = [];
    const seen = new Set<string>();

    for (const dir of modelDirs) {
      if (!fs.existsSync(dir)) continue;

      try {
        const files = fs.readdirSync(dir);
        for (const file of files) {
          if (!file.startsWith('ggml-') || !file.endsWith('.bin')) continue;
          const fullPath = path.join(dir, file);
          if (seen.has(fullPath)) continue;
          seen.add(fullPath);

          let size = 0;
          let exists = false;
          try {
            const stats = fs.statSync(fullPath);
            size = stats.size;
            exists = true;
          } catch {
            exists = false;
          }

          results.push({
            name: file,
            path: fullPath,
            size,
            exists,
          });
        }
      } catch {
        // Ignore errors reading directories
      }
    }

    return results;
  }

  /**
   * Delete a whisper model file.
   */
  deleteModel(modelPath: string): boolean {
    try {
      if (!fs.existsSync(modelPath)) return false;
      fs.unlinkSync(modelPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get the size of a model file in bytes.
   */
  getModelSize(modelPath: string): number {
    try {
      if (!fs.existsSync(modelPath)) return 0;
      const stats = fs.statSync(modelPath);
      return stats.size;
    } catch {
      return 0;
    }
  }

  /**
   * Parse whisper.cpp output to extract text
   */
  private parseWhisperOutput(output: string): string | null {
    const lines = output.split('\n');
    const texts: string[] = [];
    
    for (const line of lines) {
      const trimmed = line.trim();
      const timestampMatch = trimmed.match(/^\[\d{2}:\d{2}:\d{2}\.\d{3} --> \d{2}:\d{2}:\d{2}\.\d{3}\]\s*(.*)$/);
      if (timestampMatch) {
        const timestampText = timestampMatch[1]?.trim();
        if (timestampText) {
          texts.push(timestampText);
        }
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
