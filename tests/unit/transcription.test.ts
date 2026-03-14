import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TranscriptionService, CloudProviderConfig } from '../../src/main/transcription';

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn().mockReturnValue('/tmp'),
  },
}));

describe('TranscriptionService', () => {
  let service: TranscriptionService;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getStatus', () => {
    it('should prefer cloud provider when preferredProvider is cloud', async () => {
      const cloudProviders: CloudProviderConfig[] = [
        { id: 'openai', name: 'OpenAI', enabled: true, apiKey: 'sk-test' },
      ];

      service = new TranscriptionService({
        useLocalFirst: false,
        preferredProvider: 'cloud',
        cloudProviders,
      });

      const status = await service.getStatus(cloudProviders);
      
      expect(status.activeProvider).toBe('OpenAI');
      expect(status.cloudProviderType).toBe('openai');
    });

    it('should support legacy openaiApiKey', async () => {
      service = new TranscriptionService({
        useLocalFirst: false,
        preferredProvider: 'cloud',
        openaiApiKey: 'sk-legacy',
        cloudProviders: [],
      });

      const status = await service.getStatus();
      
      expect(status.hasCloudProvider).toBe(true);
      expect(status.activeProvider).toBe('OpenAI');
    });

    it('should filter disabled cloud providers', async () => {
      const cloudProviders: CloudProviderConfig[] = [
        { id: 'openai', name: 'OpenAI', enabled: false, apiKey: 'sk-test' },
        { id: 'groq', name: 'Groq', enabled: true, apiKey: 'gsk-test' },
      ];

      service = new TranscriptionService({
        useLocalFirst: false,
        preferredProvider: 'cloud',
        cloudProviders,
      });

      const status = await service.getStatus(cloudProviders);
      
      expect(status.activeProvider).toBe('Groq');
    });

    it('should filter cloud providers without API keys', async () => {
      const cloudProviders: CloudProviderConfig[] = [
        { id: 'openai', name: 'OpenAI', enabled: true },
        { id: 'groq', name: 'Groq', enabled: true, apiKey: 'gsk-test' },
      ];

      service = new TranscriptionService({
        useLocalFirst: false,
        preferredProvider: 'cloud',
        cloudProviders,
      });

      const status = await service.getStatus(cloudProviders);
      
      expect(status.activeProvider).toBe('Groq');
    });
  });

  describe('updateConfig', () => {
    it('should update configuration', () => {
      service = new TranscriptionService({
        useLocalFirst: true,
        language: 'en',
      });

      service.updateConfig({
        language: 'zh',
        useLocalFirst: false,
      });

      const config = (service as any).config;
      expect(config.language).toBe('zh');
      expect(config.useLocalFirst).toBe(false);
    });

    it('should merge cloud providers', () => {
      const providers: CloudProviderConfig[] = [
        { id: 'openai', name: 'OpenAI', enabled: true, apiKey: 'sk-test' },
      ];

      service = new TranscriptionService({
        useLocalFirst: true,
      });

      service.updateConfig({
        cloudProviders: providers,
      });

      const config = (service as any).config;
      expect(config.cloudProviders).toEqual(providers);
    });
  });

  describe('provider selection logic', () => {
    it('should return null when no cloud providers configured', () => {
      service = new TranscriptionService({
        cloudProviders: [],
        useLocalFirst: true,
      });

      const provider = (service as any).getActiveCloudProvider();
      expect(provider).toBeNull();
    });

    it('should return first enabled provider with API key', () => {
      const providers: CloudProviderConfig[] = [
        { id: 'openai', name: 'OpenAI', enabled: false, apiKey: 'sk-test' },
        { id: 'groq', name: 'Groq', enabled: true, apiKey: 'gsk-test' },
        { id: 'anthropic', name: 'Anthropic', enabled: true },
      ];

      service = new TranscriptionService({
        cloudProviders: providers,
        useLocalFirst: true,
      });

      const provider = (service as any).getActiveCloudProvider();
      expect(provider?.id).toBe('groq');
    });

    it('should prioritize providers in order when multiple enabled', () => {
      const providers: CloudProviderConfig[] = [
        { id: 'openai', name: 'OpenAI', enabled: true, apiKey: 'sk-test' },
        { id: 'groq', name: 'Groq', enabled: true, apiKey: 'gsk-test' },
      ];

      service = new TranscriptionService({
        cloudProviders: providers,
        useLocalFirst: true,
      });

      const provider = (service as any).getActiveCloudProvider();
      expect(provider?.id).toBe('openai');
    });
  });
});