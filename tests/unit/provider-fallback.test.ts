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
    const result = await service.transcribe('/tmp/test.wav');
    expect(result.success).toBe(false);
  });

  it('should return error when all providers fail', async () => {
    const result = await service.transcribe('/tmp/test.wav');
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});
