import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TranscriptionService } from '../../src/main/transcription';
import { mockStoreGet, resetStoreMocks } from './mocks';

describe('Provider Fallback Behavior', () => {
  let service: TranscriptionService;

  beforeEach(() => {
    vi.clearAllMocks();
    resetStoreMocks();
    service = new TranscriptionService({
      language: 'en',
      useLocalFirst: true,
      preferredProvider: 'auto',
      cloudProviders: []
    });
  });

  it('should try whisper.cpp first when useLocalFirst is true', async () => {
    vi.spyOn(service as any, 'tryWhisperTranscription')
      .mockResolvedValue({
        success: true,
        text: 'Local transcription',
        provider: 'whisper.cpp'
      });

    const result = await service.transcribe('/tmp/test.wav');
    expect(result.success).toBe(true);
    expect(result.provider).toBe('whisper.cpp');
  });

  it('should fallback to cloud providers when whisper.cpp fails', async () => {
    vi.spyOn(service as any, 'tryWhisperTranscription')
      .mockResolvedValue({
        success: false,
        error: 'whisper.cpp not available'
      });

    service.updateConfig({
      cloudProviders: [{
        id: 'openai',
        name: 'OpenAI',
        apiKey: 'test-key',
        enabled: true
      }]
    });

    vi.spyOn(service as any, 'tryCloudTranscription')
      .mockResolvedValue({
        success: true,
        text: 'Cloud transcription',
        provider: 'openai'
      });

    const result = await service.transcribe('/tmp/test.wav');
    expect(result.success).toBe(true);
    expect(result.provider).toBe('openai');
  });

  it('should try multiple cloud providers in order', async () => {
    vi.spyOn(service as any, 'tryWhisperTranscription')
      .mockResolvedValue({ success: false, error: 'local failed' });

    service.updateConfig({
      cloudProviders: [
        { id: 'openai', name: 'OpenAI', apiKey: 'key1', enabled: true },
        { id: 'groq', name: 'Groq', apiKey: 'key2', enabled: true }
      ]
    });

    const tryCloudSpy = vi.spyOn(service as any, 'tryCloudTranscription')
      .mockImplementation(async (provider: any) => {
        if (provider.id === 'openai') {
          return { success: false, error: 'OpenAI failed' };
        }
        return { success: true, text: 'Groq result', provider: 'groq' };
      });

    const result = await service.transcribe('/tmp/test.wav');

    expect(result.success).toBe(true);
    expect(result.provider).toBe('groq');
    expect(tryCloudSpy).toHaveBeenCalledTimes(2);
  });

  it('should return error when all providers fail', async () => {
    vi.spyOn(service as any, 'tryWhisperTranscription')
      .mockResolvedValue({ success: false, error: 'local failed' });

    vi.spyOn(service as any, 'tryCloudTranscription')
      .mockResolvedValue({ success: false, error: 'cloud failed' });

    const result = await service.transcribe('/tmp/test.wav');

    expect(result.success).toBe(false);
    expect(result.error).toContain('All transcription methods failed');
  });

  it('should skip disabled providers', async () => {
    service.updateConfig({
      cloudProviders: [
        { id: 'openai', name: 'OpenAI', apiKey: 'key1', enabled: false },
        { id: 'groq', name: 'Groq', apiKey: 'key2', enabled: true }
      ]
    });

    const tryCloudSpy = vi.spyOn(service as any, 'tryCloudTranscription')
      .mockResolvedValue({ success: true, text: 'result', provider: 'groq' });

    await service.transcribe('/tmp/test.wav');

    const calls = tryCloudSpy.mock.calls;
    expect(calls.some((call: any) => call[0].id === 'openai')).toBe(false);
  });

  it('should skip providers without API keys', async () => {
    service.updateConfig({
      cloudProviders: [
        { id: 'openai', name: 'OpenAI', apiKey: '', enabled: true },
        { id: 'groq', name: 'Groq', apiKey: 'valid-key', enabled: true }
      ]
    });

    const tryCloudSpy = vi.spyOn(service as any, 'tryCloudTranscription')
      .mockResolvedValue({ success: true, text: 'result', provider: 'groq' });

    await service.transcribe('/tmp/test.wav');

    const calls = tryCloudSpy.mock.calls;
    expect(calls.some((call: any) => call[0].id === 'openai')).toBe(false);
  });
});
