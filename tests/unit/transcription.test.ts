import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TranscriptionService, TranscriptionConfig, CloudProviderConfig } from '../../src/main/transcription';
import * as fs from 'fs';

// Mock electron
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn().mockReturnValue('/tmp'),
  },
}));

describe('TranscriptionService', () => {
  let service: TranscriptionService;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  describe('getStatus', () => {
    it('should return status with no whisper and no cloud providers', async () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(false);
      
      service = new TranscriptionService({
        useLocalFirst: true,
        cloudProviders: [],
      });

      const status = await service.getStatus();
      
      expect(status.whisperInstalled).toBe(false);
      expect(status.modelAvailable).toBe(false);
      expect(status.hasCloudProvider).toBe(false);
      expect(status.activeProvider).toBeUndefined();
      expect(status.recommendations.length).toBeGreaterThan(0);
    });

    it('should prefer cloud provider when preferredProvider is cloud', async () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(false);
      
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

    it('should prefer local when preferredProvider is local', async () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      
      const cloudProviders: CloudProviderConfig[] = [
        { id: 'openai', name: 'OpenAI', enabled: true, apiKey: 'sk-test' },
      ];

      service = new TranscriptionService({
        useLocalFirst: true,
        preferredProvider: 'local',
        cloudProviders,
      });

      const status = await service.getStatus(cloudProviders);
      
      expect(status.activeProvider).toBe('whisper.cpp');
    });

    it('should fallback to cloud when local not available in auto mode', async () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(false);
      
      const cloudProviders: CloudProviderConfig[] = [
        { id: 'groq', name: 'Groq', enabled: true, apiKey: 'gsk-test' },
      ];

      service = new TranscriptionService({
        useLocalFirst: true,
        preferredProvider: 'auto',
        cloudProviders,
      });

      const status = await service.getStatus(cloudProviders);
      
      expect(status.activeProvider).toBe('Groq');
      expect(status.cloudProviderType).toBe('groq');
    });

    it('should support legacy openaiApiKey', async () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(false);
      
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
      vi.spyOn(fs, 'existsSync').mockReturnValue(false);
      
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
      vi.spyOn(fs, 'existsSync').mockReturnValue(false);
      
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

  describe('transcribe', () => {
    it('should return error when audio file does not exist', async () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(false);

      service = new TranscriptionService({
        useLocalFirst: true,
      });

      const result = await service.transcribe('/nonexistent.wav');
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Audio file not found');
      expect(result.provider).toBe('none');
    });

    it('should return error when audio file is empty', async () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      vi.spyOn(fs, 'statSync').mockReturnValue({ size: 0 } as any);

      service = new TranscriptionService({
        useLocalFirst: true,
      });

      const result = await service.transcribe('/empty.wav');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('empty');
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