import { ProviderConfig, Store } from './store';
import { secureStorage } from './secure-storage';

interface Provider {
  id: string;
  name: string;
  description: string;
  requireApiKey: boolean;
  defaultBaseUrl?: string;
  defaultModel?: string;
  supportedModels: string[];
}

interface Provider {
  id: string;
  name: string;
  description: string;
  requireApiKey: boolean;
  defaultBaseUrl?: string;
  defaultModel?: string;
  supportedModels: string[];
  category: 'transcription' | 'post-processing';
}

// Providers that support audio-to-text transcription (ASR)
const TRANSCRIPTION_PROVIDERS: Provider[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    description: 'Use OpenAI Whisper API for transcription',
    requireApiKey: true,
    defaultModel: 'whisper-1',
    supportedModels: ['whisper-1'],
    category: 'transcription',
  },
  {
    id: 'groq',
    name: 'Groq',
    description: 'Fast Whisper inference on Groq',
    requireApiKey: true,
    defaultBaseUrl: 'https://api.groq.com/openai/v1/audio/transcriptions',
    defaultModel: 'whisper-large-v3',
    supportedModels: ['whisper-large-v3', 'whisper-large-v3-turbo', 'distil-whisper-large-v3-en'],
    category: 'transcription',
  },
  // Chinese ASR Providers - TODO: Implement API integration
  {
    id: 'aliyun-asr',
    name: '阿里云语音识别',
    description: '阿里云智能语音交互，支持中文及多方言识别',
    requireApiKey: true,
    defaultBaseUrl: 'https://nls-gateway-cn-shanghai.aliyuncs.com/stream/v1/asr',
    defaultModel: 'default',
    supportedModels: ['default'],
    category: 'transcription',
  },
  {
    id: 'tencent-asr',
    name: '腾讯云语音识别',
    description: '腾讯云ASR，支持实时和录音文件识别',
    requireApiKey: true,
    defaultBaseUrl: 'https://asr.tencentcloudapi.com',
    defaultModel: '16k_zh',
    supportedModels: ['16k_zh', '16k_en', '8k_zh'],
    category: 'transcription',
  },
  {
    id: 'baidu-asr',
    name: '百度语音识别',
    description: '百度AI语音识别，中文识别准确率高',
    requireApiKey: true,
    defaultBaseUrl: 'https://vop.baidu.com/server_api',
    defaultModel: 'dev_pid_1537',
    supportedModels: ['dev_pid_1537', 'dev_pid_1737'],
    category: 'transcription',
  },
  {
    id: 'iflytek-asr',
    name: '科大讯飞',
    description: '讯飞语音识别，支持多种方言和专业领域',
    requireApiKey: true,
    defaultBaseUrl: 'https://iat-api.xfyun.cn/v2/iat',
    defaultModel: 'iat',
    supportedModels: ['iat'],
    category: 'transcription',
  },
];

// Providers that support text post-processing (LLMs)
const POST_PROCESSING_PROVIDERS: Provider[] = [
  {
    id: 'anthropic',
    name: 'Anthropic',
    description: 'Use Claude for post-processing',
    requireApiKey: true,
    supportedModels: ['claude-3-sonnet', 'claude-3-opus', 'claude-3-haiku'],
    category: 'post-processing',
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    description: 'DeepSeek AI for post-processing and text optimization',
    requireApiKey: true,
    defaultBaseUrl: 'https://api.deepseek.com',
    defaultModel: 'deepseek-chat',
    supportedModels: ['deepseek-chat', 'deepseek-coder'],
    category: 'post-processing',
  },
  {
    id: 'zhipu',
    name: '智谱 GLM',
    description: '智谱 AI GLM 模型，优秀的文本处理能力',
    requireApiKey: true,
    defaultBaseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    defaultModel: 'glm-4',
    supportedModels: ['glm-4', 'glm-4-flash', 'glm-4-long'],
    category: 'post-processing',
  },
  {
    id: 'minimax',
    name: 'MiniMax',
    description: 'MiniMax 海螺 AI，文本后处理',
    requireApiKey: true,
    defaultBaseUrl: 'https://api.minimax.chat/v1',
    defaultModel: 'abab6.5s-chat',
    supportedModels: ['abab6.5s-chat', 'abab6.5-chat'],
    category: 'post-processing',
  },
  {
    id: 'moonshot',
    name: 'Kimi (Moonshot)',
    description: 'Moonshot Kimi AI，长文本后处理',
    requireApiKey: true,
    defaultBaseUrl: 'https://api.moonshot.cn/v1',
    defaultModel: 'moonshot-v1-8k',
    supportedModels: ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k'],
    category: 'post-processing',
  },
  {
    id: 'openai',
    name: 'OpenAI',
    description: 'Use OpenAI GPT for post-processing',
    requireApiKey: true,
    supportedModels: ['gpt-4o', 'gpt-4o-mini', 'gpt-4'],
    category: 'post-processing',
  },
  {
    id: 'groq',
    name: 'Groq',
    description: 'Use Groq LLM for post-processing',
    requireApiKey: true,
    defaultModel: 'llama-3.3-70b-versatile',
    supportedModels: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b'],
    category: 'post-processing',
  },
  {
    id: 'local',
    name: 'Local Model',
    description: 'Use local LLM for post-processing',
    requireApiKey: false,
    defaultBaseUrl: 'http://localhost:11434',
    supportedModels: ['local-llm'],
    category: 'post-processing',
  },
];

// Combined list for backward compatibility
const AVAILABLE_PROVIDERS: Provider[] = [...TRANSCRIPTION_PROVIDERS, ...POST_PROCESSING_PROVIDERS];

export class ProviderManager {
  private store: Store;

  constructor(store: Store) {
    this.store = store;
  }

  async getProviderApiKey(providerId: string): Promise<string | null> {
    return await secureStorage.getProviderApiKey(providerId);
  }

  async setProviderApiKey(providerId: string, apiKey: string): Promise<void> {
    await secureStorage.setProviderApiKey(providerId, apiKey);
  }

  async deleteProviderApiKey(providerId: string): Promise<void> {
    await secureStorage.deleteProviderApiKey(providerId);
  }

  listProviders(): Provider[] {
    return AVAILABLE_PROVIDERS;
  }

  listTranscriptionProviders(): Provider[] {
    return TRANSCRIPTION_PROVIDERS;
  }

  listPostProcessingProviders(): Provider[] {
    return POST_PROCESSING_PROVIDERS;
  }

  async getConfig(providerId: string): Promise<{ provider: Provider; config: ProviderConfig } | null> {
    const provider = AVAILABLE_PROVIDERS.find(p => p.id === providerId);
    if (!provider) return null;

    const providers = this.store.get('providers');
    const config = providers.find(p => p.id === providerId);

    // Check if key exists in secure storage
    let hasKeyInKeychain = await secureStorage.hasProviderApiKey(providerId);

    // For providers with credentials (like Alibaba Cloud), check credential keys
    if (!hasKeyInKeychain && providerId === 'aliyun-asr') {
      const hasAccessKeyId = await secureStorage.hasProviderCredential(providerId, 'accessKeyId');
      const hasAccessKeySecret = await secureStorage.hasProviderCredential(providerId, 'accessKeySecret');
      hasKeyInKeychain = hasAccessKeyId && hasAccessKeySecret;
    }

    return {
      provider,
      config: {
        ...(config || { id: providerId, name: provider.name, enabled: false }),
        apiKey: undefined, // Never return the actual key
        hasKeyInKeychain
      },
    };
  }

  async setConfig(providerId: string, config: Partial<ProviderConfig> & { apiKey?: string; credentials?: Record<string, string> }): Promise<boolean> {
    try {
      const provider = AVAILABLE_PROVIDERS.find(p => p.id === providerId);
      const providers = [...this.store.get('providers')];
      const index = providers.findIndex(p => p.id === providerId);

      // Handle single API key (traditional)
      if (config.apiKey !== undefined) {
        if (config.apiKey) {
          await secureStorage.setProviderApiKey(providerId, config.apiKey);
          config.hasKeyInKeychain = true;
        } else {
          await secureStorage.deleteProviderApiKey(providerId);
          config.hasKeyInKeychain = false;
        }
        delete config.apiKey;
      }

      // Handle credentials key-value pairs (for providers like Alibaba Cloud)
      if (config.credentials !== undefined) {
        for (const [keyName, value] of Object.entries(config.credentials)) {
          if (value) {
            await secureStorage.setProviderCredential(providerId, keyName, value);
          } else {
            await secureStorage.deleteProviderCredential(providerId, keyName);
          }
        }
        config.hasKeyInKeychain = Object.keys(config.credentials).length > 0;
        delete config.credentials;
      }

      if (index >= 0) {
        providers[index] = { ...providers[index], ...config };
      } else {
        providers.push({
          id: providerId,
          name: provider?.name || providerId,
          enabled: false,
          ...config,
        });
      }

      this.store.set('providers', providers);
      return true;
    } catch (error) {
      console.error('[ProviderManager] Failed to set config:', error);
      return false;
    }
  }

  async testConnection(providerId: string): Promise<{ success: boolean; error?: string }> {
    const config = await this.getConfig(providerId);
    if (!config) {
      return { success: false, error: 'Provider not found' };
    }

    const cfg = config.config;

    const isEnabled = cfg.enabledForTranscription ?? cfg.enabled;
    if (!isEnabled) {
      return { success: false, error: 'Provider not enabled' };
    }

    // Handle providers with multiple credentials (like Alibaba Cloud)
    if (providerId === 'aliyun-asr') {
      const accessKeyId = await secureStorage.getProviderCredential(providerId, 'accessKeyId');
      const accessKeySecret = await secureStorage.getProviderCredential(providerId, 'accessKeySecret');

      if (!accessKeyId || !accessKeySecret) {
        return { success: false, error: 'AccessKey ID and AccessKey Secret required' };
      }

      return this.testAlibabaCloudConnection(accessKeyId, accessKeySecret);
    }

    const apiKey = await secureStorage.getProviderApiKey(providerId);
    if (config.provider.requireApiKey && !apiKey) {
      return { success: false, error: 'API key required' };
    }

    // For cloud transcription providers (OpenAI, Groq), try a lightweight API call
    if (providerId === 'openai' || providerId === 'groq') {
      try {
        const fetch = (await import('node-fetch')).default;

        let testUrl: string;
        if (providerId === 'groq') {
          testUrl = 'https://api.groq.com/openai/v1/models';
        } else {
          testUrl = 'https://api.openai.com/v1/models';
        }

        const response = await fetch(testUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
          },
          timeout: 10000
        } as any);

        if (!response.ok) {
          const errorText = await response.text();
          let errorMessage: string;
          try {
            const errorJson = JSON.parse(errorText);
            errorMessage = errorJson.error?.message || errorJson.message || errorText;
          } catch {
            errorMessage = errorText || `HTTP ${response.status}`;
          }
          return { success: false, error: errorMessage };
        }

        return { success: true };
      } catch (error: any) {
        return { success: false, error: error?.message || 'Connection test failed' };
      }
    }

    // For Chinese AI providers (DeepSeek, Zhipu, MiniMax, Moonshot)
    if (['deepseek', 'zhipu', 'minimax', 'moonshot'].includes(providerId)) {
      try {
        const fetch = (await import('node-fetch')).default;

        let testUrl: string;
        switch (providerId) {
          case 'deepseek':
            testUrl = 'https://api.deepseek.com/v1/models';
            break;
          case 'zhipu':
            testUrl = 'https://open.bigmodel.cn/api/paas/v4/models';
            break;
          case 'minimax':
            testUrl = 'https://api.minimax.chat/v1/models';
            break;
          case 'moonshot':
            testUrl = 'https://api.moonshot.cn/v1/models';
            break;
          default:
            return { success: false, error: 'Unknown provider' };
        }

        const response = await fetch(testUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
          },
          timeout: 10000
        } as any);

        if (!response.ok) {
          const errorText = await response.text();
          let errorMessage: string;
          try {
            const errorJson = JSON.parse(errorText);
            errorMessage = errorJson.error?.message || errorJson.message || errorText;
          } catch {
            errorMessage = errorText || `HTTP ${response.status}`;
          }
          return { success: false, error: errorMessage };
        }

        return { success: true };
      } catch (error: any) {
        return { success: false, error: error?.message || 'Connection test failed' };
      }
    }

    // For other providers, just verify config is present
    return { success: true };
  }

  /**
   * Test Alibaba Cloud ASR connection by verifying credentials
   */
  private async testAlibabaCloudConnection(accessKeyId: string, accessKeySecret: string): Promise<{ success: boolean; error?: string }> {
    try {
      const fetch = (await import('node-fetch')).default;
      const crypto = await import('crypto');

      // Use Alibaba Cloud STS AssumeRole API as a lightweight test
      // This validates credentials without consuming ASR quota
      const date = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
      const region = 'cn-shanghai';
      const endpoint = `https://sts.${region}.aliyuncs.com`;

      // Build canonical query string
      const params = new URLSearchParams({
        'Action': 'GetCallerIdentity',
        'Version': '2015-04-01',
        'Format': 'JSON',
        'AccessKeyId': accessKeyId,
        'SignatureMethod': 'HMAC-SHA1',
        'SignatureVersion': '1.0',
        'SignatureNonce': crypto.randomUUID(),
        'Timestamp': date
      });

      // Sort parameters
      const sortedParams = new URLSearchParams([...params.entries()].sort());

      // Create string to sign
      const stringToSign = `GET&${encodeURIComponent('/')}&${encodeURIComponent(sortedParams.toString())}`;

      // Generate signature
      const signature = crypto.createHmac('sha1', `${accessKeySecret}&`)
        .update(stringToSign)
        .digest('base64');

      // Add signature to params
      sortedParams.set('Signature', signature);

      const response = await fetch(`${endpoint}/?${sortedParams.toString()}`, {
        method: 'GET',
        timeout: 10000
      } as any);

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage: string;
        try {
          const errorJson = JSON.parse(errorText);
          const code = errorJson.Code || errorJson.code;
          const message = errorJson.Message || errorJson.message;

          if (code === 'InvalidAccessKeyId.NotFound' || code === 'SignatureDoesNotMatch') {
            return { success: false, error: 'Invalid AccessKey ID or Secret. Please check your credentials in Alibaba Cloud console.' };
          }
          errorMessage = message || errorText;
        } catch {
          errorMessage = errorText || `HTTP ${response.status}`;
        }
        return { success: false, error: errorMessage };
      }

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error?.message || 'Alibaba Cloud connection test failed' };
    }
  }

  getActiveProvider(): { provider: Provider; config: ProviderConfig } | null {
    const providers = this.store.get('providers');
    const active = providers.find(p => p.enabled);

    if (!active) return null;

    const provider = AVAILABLE_PROVIDERS.find(p => p.id === active.id);
    if (!provider) return null;

    return { provider, config: active };
  }
}
