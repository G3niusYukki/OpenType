import { ProviderConfig, Store } from './store';

interface Provider {
  id: string;
  name: string;
  description: string;
  requireApiKey: boolean;
  defaultBaseUrl?: string;
  defaultModel?: string;
  supportedModels: string[];
}

const AVAILABLE_PROVIDERS: Provider[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    description: 'Use OpenAI Whisper API for transcription',
    requireApiKey: true,
    defaultModel: 'whisper-1',
    supportedModels: ['whisper-1'],
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    description: 'Use Claude for post-processing',
    requireApiKey: true,
    supportedModels: ['claude-3-sonnet', 'claude-3-opus', 'claude-3-haiku'],
  },
  {
    id: 'groq',
    name: 'Groq',
    description: 'Fast Whisper inference on Groq',
    requireApiKey: true,
    defaultBaseUrl: 'https://api.groq.com/openai/v1/audio/transcriptions',
    defaultModel: 'whisper-large-v3',
    supportedModels: ['whisper-large-v3', 'whisper-large-v3-turbo', 'distil-whisper-large-v3-en'],
  },
  {
    id: 'local',
    name: 'Local Model',
    description: 'Use local whisper.cpp or similar',
    requireApiKey: false,
    defaultBaseUrl: 'http://localhost:8080',
    supportedModels: ['local-whisper'],
  },
];

export class ProviderManager {
  private store: Store;

  constructor(store: Store) {
    this.store = store;
  }

  listProviders(): Provider[] {
    return AVAILABLE_PROVIDERS;
  }

  getConfig(providerId: string): { provider: Provider; config: ProviderConfig } | null {
    const provider = AVAILABLE_PROVIDERS.find(p => p.id === providerId);
    if (!provider) return null;

    const providers = this.store.get('providers');
    const config = providers.find(p => p.id === providerId);

    return {
      provider,
      config: config || { id: providerId, name: provider.name, enabled: false },
    };
  }

  setConfig(providerId: string, config: Partial<ProviderConfig>): boolean {
    try {
      const provider = AVAILABLE_PROVIDERS.find(p => p.id === providerId);
      const providers = [...this.store.get('providers')];
      const index = providers.findIndex(p => p.id === providerId);

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
    const config = this.getConfig(providerId);
    if (!config) {
      return { success: false, error: 'Provider not found' };
    }

    const cfg = config.config;

    if (!cfg.enabled) {
      return { success: false, error: 'Provider not enabled' };
    }

    if (config.provider.requireApiKey && !cfg.apiKey) {
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
            'Authorization': `Bearer ${cfg.apiKey}`,
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

  getActiveProvider(): { provider: Provider; config: ProviderConfig } | null {
    const providers = this.store.get('providers');
    const active = providers.find(p => p.enabled);

    if (!active) return null;

    const provider = AVAILABLE_PROVIDERS.find(p => p.id === active.id);
    if (!provider) return null;

    return { provider, config: active };
  }
}
