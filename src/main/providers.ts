import { ProviderConfig, Store } from './store';

interface Provider {
  id: string;
  name: string;
  description: string;
  requireApiKey: boolean;
  defaultBaseUrl?: string;
  supportedModels: string[];
}

const AVAILABLE_PROVIDERS: Provider[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    description: 'Use OpenAI Whisper API for transcription',
    requireApiKey: true,
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
    supportedModels: ['whisper-large-v3'],
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
