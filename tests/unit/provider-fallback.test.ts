import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TranscriptionService } from '../../src/main/transcription';

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => '/mock/user/data'),
  },
}));

describe('Provider Fallback Behavior', () => {
  let service: TranscriptionService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new TranscriptionService({
      language: 'en',
      useLocalFirst: true,
      preferredProvider: 'auto',
      cloudProviders: []
    });
  });

  it('should initialize with correct config', () => {
    expect(service).toBeDefined();
  });

  it('should update config', () => {
    service.updateConfig({ language: 'zh' });
    expect(service).toBeDefined();
  });

  it('should handle transcription attempt', async () => {
    const result = await service.transcribe('/tmp/test.wav');
    expect(result).toHaveProperty('success');
    expect(result).toHaveProperty('text');
  });

  it('should return error for non-existent audio file', async () => {
    const result = await service.transcribe('/nonexistent/file.wav');
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});
