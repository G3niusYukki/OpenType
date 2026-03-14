import { Store } from './store';

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

  getConfig(providerId: string): { provider: Provider; config: unknown } | null {
    const provider = AVAILABLE_PROVIDERS.find(p => p.id === providerId);
    if (!provider) return null;

    const providers = this.store.get('providers');
    const config = providers.find(p => p.id === providerId);
    
    return {
      provider,
      config: config || { id: providerId, enabled: false },
    };
  }

  setConfig(providerId: string, config: unknown): boolean {
    try {
      const providers = this.store.get('providers');
      const index = providers.findIndex(p => p.id === providerId);
      
      if (index >= 0) {
        providers[index] = { ...providers[index], ...config };
      } else {
        providers.push({ id: providerId, ...config } as { id: string; name: string; enabled: boolean; apiKey?: string; baseUrl?: string; model?: string });
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

    const cfg = config.config as { enabled?: boolean; apiKey?: string; baseUrl?: string };
    
    if (!cfg.enabled) {
      return { success: false, error: 'Provider not enabled' };
    }

    if (config.provider.requireApiKey && !cfg.apiKey) {
      return { success: false, error: 'API key required' };
    }

    // v1: Just validate config exists
    // Future: Actually test the connection with a ping request
    
    return { success: true };
  }

  /**
   * Get the active transcription provider
   */
  getActiveProvider(): { provider: Provider; config: unknown } | null {
    const providers = this.store.get('providers');
    const active = providers.find(p => p.enabled);
    
    if (!active) return null;
    
    const provider = AVAILABLE_PROVIDERS.find(p => p.id === active.id);
    if (!provider) return null;
    
    return { provider, config: active };
  }
}
