import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ProviderManager } from '../../src/main/providers';
import { Store, ProviderConfig } from '../../src/main/store';

// Mock node-fetch
vi.mock('node-fetch', () => ({
  default: vi.fn(),
}));

describe('ProviderManager', () => {
  let manager: ProviderManager;
  let mockStore: {
    get: ReturnType<typeof vi.fn>;
    set: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockStore = {
      get: vi.fn(),
      set: vi.fn(),
    };
    manager = new ProviderManager(mockStore as unknown as Store);
  });

  describe('listProviders', () => {
    it('should return all available providers', () => {
      const providers = manager.listProviders();
      expect(providers.length).toBeGreaterThan(0);
      expect(providers.some(p => p.id === 'openai')).toBe(true);
      expect(providers.some(p => p.id === 'groq')).toBe(true);
    });
  });

  describe('listTranscriptionProviders', () => {
    it('should return only transcription providers', () => {
      const providers = manager.listTranscriptionProviders();
      expect(providers.every(p => p.category === 'transcription')).toBe(true);
      expect(providers.some(p => p.id === 'openai')).toBe(true);
      expect(providers.some(p => p.id === 'groq')).toBe(true);
      expect(providers.some(p => p.id === 'aliyun-asr')).toBe(true);
    });

    it('should not include post-processing providers', () => {
      const providers = manager.listTranscriptionProviders();
      expect(providers.some(p => p.id === 'deepseek')).toBe(false);
      expect(providers.some(p => p.id === 'anthropic')).toBe(false);
    });
  });

  describe('listPostProcessingProviders', () => {
    it('should return only post-processing providers', () => {
      const providers = manager.listPostProcessingProviders();
      expect(providers.every(p => p.category === 'post-processing')).toBe(true);
      expect(providers.some(p => p.id === 'deepseek')).toBe(true);
      expect(providers.some(p => p.id === 'anthropic')).toBe(true);
      expect(providers.some(p => p.id === 'zhipu')).toBe(true);
    });

    it('should not include transcription-only providers', () => {
      const providers = manager.listPostProcessingProviders();
      expect(providers.some(p => p.id === 'aliyun-asr')).toBe(false);
      expect(providers.some(p => p.id === 'tencent-asr')).toBe(false);
    });
  });

  describe('getConfig', () => {
    it('should return provider config when found', () => {
      const configs: ProviderConfig[] = [
        { id: 'openai', name: 'OpenAI', enabled: true, apiKey: 'sk-test' },
      ];
      mockStore.get.mockReturnValue(configs);

      const result = manager.getConfig('openai');
      expect(result).not.toBeNull();
      expect(result?.provider.id).toBe('openai');
      expect(result?.config.apiKey).toBe('sk-test');
    });

    it('should return default config when provider not in store', () => {
      mockStore.get.mockReturnValue([]);

      const result = manager.getConfig('openai');
      expect(result).not.toBeNull();
      expect(result?.config.enabled).toBe(false);
    });

    it('should return null for unknown provider', () => {
      const result = manager.getConfig('unknown-provider');
      expect(result).toBeNull();
    });
  });

  describe('setConfig', () => {
    it('should update existing provider config', () => {
      const existingConfigs: ProviderConfig[] = [
        { id: 'openai', name: 'OpenAI', enabled: false },
      ];
      mockStore.get.mockReturnValue(existingConfigs);

      const result = manager.setConfig('openai', { enabled: true, apiKey: 'sk-test' });
      
      expect(result).toBe(true);
      expect(mockStore.set).toHaveBeenCalledWith('providers', [
        { id: 'openai', name: 'OpenAI', enabled: true, apiKey: 'sk-test' },
      ]);
    });

    it('should add new provider config', () => {
      mockStore.get.mockReturnValue([]);

      const result = manager.setConfig('openai', { enabled: true, apiKey: 'sk-test' });
      
      expect(result).toBe(true);
      const savedProviders = mockStore.set.mock.calls[0][1];
      expect(savedProviders).toHaveLength(1);
      expect(savedProviders[0].apiKey).toBe('sk-test');
    });
  });

  describe('testConnection', () => {
    it('should return error when provider not found', async () => {
      const result = await manager.testConnection('unknown-provider');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Provider not found');
    });

    it('should return error when provider not enabled', async () => {
      mockStore.get.mockReturnValue([
        { id: 'openai', name: 'OpenAI', enabled: false },
      ]);

      const result = await manager.testConnection('openai');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Provider not enabled');
    });

    it('should return error when API key required but missing', async () => {
      mockStore.get.mockReturnValue([
        { id: 'openai', name: 'OpenAI', enabled: true },
      ]);

      const result = await manager.testConnection('openai');
      expect(result.success).toBe(false);
      expect(result.error).toBe('API key required');
    });

    it('should skip API key check for providers that do not require it', async () => {
      mockStore.get.mockReturnValue([
        { id: 'local', name: 'Local Model', enabled: true },
      ]);

      const result = await manager.testConnection('local');
      expect(result.success).toBe(true);
    });
  });

  describe('getActiveProvider', () => {
    it('should return first enabled provider', () => {
      mockStore.get.mockReturnValue([
        { id: 'openai', name: 'OpenAI', enabled: false },
        { id: 'groq', name: 'Groq', enabled: true, apiKey: 'test' },
      ]);

      const result = manager.getActiveProvider();
      expect(result).not.toBeNull();
      expect(result?.provider.id).toBe('groq');
    });

    it('should return null when no provider enabled', () => {
      mockStore.get.mockReturnValue([
        { id: 'openai', name: 'OpenAI', enabled: false },
      ]);

      const result = manager.getActiveProvider();
      expect(result).toBeNull();
    });
  });
});