import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockExecFile = vi.hoisted(() => vi.fn());
const mockSpawn = vi.hoisted(() => vi.fn());
const mockFetch = vi.hoisted(() => vi.fn());
const mockFormDataAppend = vi.hoisted(() => vi.fn());
const mockFormDataGetHeaders = vi.hoisted(() => vi.fn(() => ({ 'content-type': 'multipart/form-data' })));
const mockGetPath = vi.hoisted(() => vi.fn());

const mockExistsSync = vi.hoisted(() => vi.fn());
const mockStatSync = vi.hoisted(() => vi.fn());
const mockReadFileSync = vi.hoisted(() => vi.fn());
const mockUnlinkSync = vi.hoisted(() => vi.fn());
const mockCreateReadStream = vi.hoisted(() => vi.fn());

vi.mock('child_process', () => ({
  spawn: mockSpawn,
  execFile: mockExecFile,
  default: {
    spawn: mockSpawn,
    execFile: mockExecFile,
  },
}));

vi.mock('util', () => ({
  promisify: vi.fn((fn) => fn),
  default: {
    promisify: vi.fn((fn) => fn),
  },
}));

vi.mock('electron', () => ({
  app: {
    getPath: mockGetPath,
  },
}));

vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal() as typeof import('fs');
  const mockedFs = {
    ...actual,
    existsSync: mockExistsSync,
    statSync: mockStatSync,
    readFileSync: mockReadFileSync,
    unlinkSync: mockUnlinkSync,
    createReadStream: mockCreateReadStream,
  };

  return {
    __esModule: true,
    ...mockedFs,
    default: mockedFs,
  };
});

vi.mock('node-fetch', () => ({
  default: mockFetch,
}));

vi.mock('form-data', () => {
  return {
    default: class MockFormData {
      append = mockFormDataAppend;
      getHeaders = mockFormDataGetHeaders;
    }
  };
});

import { TranscriptionService, CloudProviderConfig } from '../../src/main/transcription';

function setupFsMock(existsMap: Record<string, boolean> = {}) {
  mockExistsSync.mockImplementation((p: string) => {
    for (const [key, value] of Object.entries(existsMap)) {
      if (p.includes(key)) return value;
    }
    return false;
  });
}

function resetTestMocks() {
  mockExecFile.mockReset();
  mockSpawn.mockReset();
  mockFetch.mockReset();
  mockFormDataAppend.mockReset();
  mockFormDataGetHeaders.mockReset();
  mockFormDataGetHeaders.mockReturnValue({ 'content-type': 'multipart/form-data' });
  mockGetPath.mockReset();
  mockGetPath.mockReturnValue('/tmp');
  mockExistsSync.mockReset();
  setupFsMock();
  mockStatSync.mockReset();
  mockStatSync.mockReturnValue({ size: 1000 } as any);
  mockReadFileSync.mockReset();
  mockUnlinkSync.mockReset();
  mockCreateReadStream.mockReset();
}

describe('TranscriptionService', () => {
  let service: TranscriptionService;

  beforeEach(() => {
    resetTestMocks();
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

    it('should return whisper.cpp as active provider when whisper and model are available', async () => {
      setupFsMock({
        'whisper-cpp': true,
        'ggml-base.bin': true,
      });

      service = new TranscriptionService({
        useLocalFirst: true,
        preferredProvider: 'auto',
      });

      const status = await service.getStatus();
      
      expect(status.whisperInstalled).toBe(true);
      expect(status.modelAvailable).toBe(true);
    });

    it('should provide recommendations when whisper is not installed', async () => {
      mockExistsSync.mockReturnValue(false);

      service = new TranscriptionService({
        useLocalFirst: true,
      });

      const status = await service.getStatus();
      
      expect(status.recommendations.length).toBeGreaterThan(0);
      expect(status.recommendations.some(r => r.includes('brew install'))).toBe(true);
    });

    it('should provide recommendations when model is not available', async () => {
      setupFsMock({
        'whisper-cpp': true,
        'ggml-base.bin': false,
      });

      service = new TranscriptionService({
        useLocalFirst: true,
      });

      const status = await service.getStatus();
      
      expect(status.recommendations.some(r => r.includes('Download'))).toBe(true);
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

    it('should reset cached availability when config is updated', () => {
      service = new TranscriptionService({
        useLocalFirst: true,
      });

      (service as any).whisperAvailable = true;
      (service as any).modelAvailable = true;

      service.updateConfig({
        language: 'zh',
      });

      expect((service as any).whisperAvailable).toBeNull();
      expect((service as any).modelAvailable).toBeNull();
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

    it('should fallback to legacy openaiApiKey when no providers configured', () => {
      service = new TranscriptionService({
        cloudProviders: [],
        openaiApiKey: 'sk-legacy-key',
        useLocalFirst: true,
      });

      const provider = (service as any).getActiveCloudProvider();
      expect(provider?.id).toBe('openai');
      expect(provider?.apiKey).toBe('sk-legacy-key');
    });
  });

  describe('transcribe() main orchestration', () => {
    beforeEach(() => {
      setupFsMock({ '/path/to/audio.wav': true });
      mockStatSync.mockReturnValue({ size: 1000 } as any);
    });

    it('should return error when file not found', async () => {
      mockExistsSync.mockReturnValue(false);

      service = new TranscriptionService({
        useLocalFirst: true,
      });

      const result = await service.transcribe('/path/to/audio.wav');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Audio file not found');
      expect(result.provider).toBe('none');
    });

    it('should return error when file is empty', async () => {
      mockExistsSync.mockReturnValue(true);
      mockStatSync.mockReturnValue({ size: 0 } as any);

      service = new TranscriptionService({
        useLocalFirst: true,
      });

      const result = await service.transcribe('/path/to/audio.wav');

      expect(result.success).toBe(false);
      expect(result.error).toContain('empty');
      expect(result.provider).toBe('none');
    });

    it('should use whisper.cpp when useLocalFirst is true and it succeeds', async () => {
      const mockText = 'Hello world';
      
      setupFsMock({
        'whisper-cpp': true,
        'ggml': true,
      });

      mockExecFile.mockResolvedValue({
        stdout: mockText,
        stderr: '',
      });

      setupFsMock({
        '/path/to/audio.wav': true,
        'whisper-cpp': true,
        'ggml': true,
      });
      mockReadFileSync.mockReturnValue(mockText);

      service = new TranscriptionService({
        useLocalFirst: true,
        language: 'en',
      });

      const result = await service.transcribe('/path/to/audio.wav');

      expect(result.success).toBe(true);
      expect(result.text).toBe(mockText);
      expect(result.provider).toBe('whisper.cpp');
      expect(mockExecFile).toHaveBeenCalled();
    });

    it('should fallback to cloud when whisper.cpp fails', async () => {
      const mockText = 'Cloud transcription result';
      
      setupFsMock({
        '/path/to/audio.wav': true,
        'whisper-cpp': true,
        'ggml': true,
      });

      mockExecFile.mockRejectedValue(new Error('whisper failed'));

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ text: mockText }),
      });

      service = new TranscriptionService({
        useLocalFirst: true,
        cloudProviders: [
          { id: 'openai', name: 'OpenAI', enabled: true, apiKey: 'sk-test' },
        ],
      });

      const result = await service.transcribe('/path/to/audio.wav');

      expect(result.success).toBe(true);
      expect(result.text).toBe(mockText);
      expect(result.provider).toBe('openai');
    });

    it('should return placeholder result when all providers fail', async () => {
      setupFsMock({ '/path/to/audio.wav': true });
      mockExecFile.mockRejectedValue(new Error('whisper failed'));
      mockFetch.mockRejectedValue(new Error('cloud error'));

      service = new TranscriptionService({
        useLocalFirst: true,
        cloudProviders: [
          { id: 'openai', name: 'OpenAI', enabled: true, apiKey: 'sk-test' },
        ],
      });

      const result = await service.transcribe('/path/to/audio.wav');

      expect(result.success).toBe(false);
      expect(result.provider).toBe('none');
    });

    it('should skip local whisper when useLocalFirst is false', async () => {
      setupFsMock({ '/path/to/audio.wav': true });
      
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ text: 'Cloud result' }),
      });

      service = new TranscriptionService({
        useLocalFirst: false,
        cloudProviders: [
          { id: 'openai', name: 'OpenAI', enabled: true, apiKey: 'sk-test' },
        ],
      });

      const result = await service.transcribe('/path/to/audio.wav');

      expect(mockExecFile).not.toHaveBeenCalled();
      expect(result.provider).toBe('openai');
    });

    it('should aggregate errors from failed providers', async () => {
      setupFsMock({ '/path/to/audio.wav': true });
      mockExecFile.mockRejectedValue(new Error('whisper error'));
      mockFetch.mockRejectedValue(new Error('cloud error'));

      service = new TranscriptionService({
        useLocalFirst: true,
        cloudProviders: [
          { id: 'openai', name: 'OpenAI', enabled: true, apiKey: 'sk-test' },
        ],
      });

      const result = await service.transcribe('/path/to/audio.wav');

      expect(result.success).toBe(false);
      expect(result.error).toContain('cloud error');
    });
  });

  describe('transcribeWithWhisperCpp()', () => {
    it('should return error when whisper binary not found', async () => {
      mockExistsSync.mockReturnValue(false);

      service = new TranscriptionService({
        useLocalFirst: true,
      });

      const result = await (service as any).transcribeWithWhisperCpp('/path/to/audio.wav');

      expect(result.success).toBe(false);
      expect(result.error).toContain('whisper.cpp not found');
      expect(result.provider).toBe('local');
    });

    it('should return error when model not found', async () => {
      setupFsMock({
        'whisper-cpp': true,
        'ggml': false,
      });

      service = new TranscriptionService({
        useLocalFirst: true,
      });

      const result = await (service as any).transcribeWithWhisperCpp('/path/to/audio.wav');

      expect(result.success).toBe(false);
      expect(result.error).toContain('model not found');
      expect(result.provider).toBe('local');
    });

    it('should successfully transcribe with whisper.cpp using output file', async () => {
      const mockText = 'Transcribed text from file';
      
      setupFsMock({
        'whisper-cpp': true,
        'ggml': true,
        'transcription_': true,
      });

      mockExecFile.mockResolvedValue({
        stdout: '',
        stderr: '',
      });
      mockReadFileSync.mockReturnValue(mockText);

      service = new TranscriptionService({
        useLocalFirst: true,
        language: 'en',
      });

      const result = await (service as any).transcribeWithWhisperCpp('/path/to/audio.wav');

      expect(result.success).toBe(true);
      expect(result.text).toBe(mockText);
      expect(result.provider).toBe('whisper.cpp');
    });

    it('should fallback to stdout parsing when output file is empty', async () => {
      const mockText = 'Transcribed text from stdout';
      
      setupFsMock({
        'whisper-cpp': true,
        'ggml': true,
        'transcription_': false,
      });

      mockExecFile.mockResolvedValue({
        stdout: mockText,
        stderr: '',
      });
      mockReadFileSync.mockReturnValue('');

      service = new TranscriptionService({
        useLocalFirst: true,
      });

      const result = await (service as any).transcribeWithWhisperCpp('/path/to/audio.wav');

      expect(result.success).toBe(true);
      expect(result.text).toBe(mockText);
    });

    it('should clean up output file after reading', async () => {
      setupFsMock({
        'whisper-cpp': true,
        'ggml': true,
        'transcription_': true,
      });

      mockExecFile.mockResolvedValue({
        stdout: '',
        stderr: '',
      });
      mockReadFileSync.mockReturnValue('Test text');

      service = new TranscriptionService({
        useLocalFirst: true,
      });

      await (service as any).transcribeWithWhisperCpp('/path/to/audio.wav');

      expect(mockUnlinkSync).toHaveBeenCalled();
    });

    it('should handle timeout gracefully', async () => {
      setupFsMock({
        'whisper-cpp': true,
        'ggml': true,
        'transcription_': true,
      });

      mockExecFile.mockRejectedValue({ message: 'timeout', code: 'ETIMEDOUT' });

      service = new TranscriptionService({
        useLocalFirst: true,
      });

      const result = await (service as any).transcribeWithWhisperCpp('/path/to/audio.wav');

      expect(result.success).toBe(false);
      expect(result.error).toContain('timeout');
    });

    it('should handle execFile errors', async () => {
      setupFsMock({
        'whisper-cpp': true,
        'ggml': true,
      });

      mockExecFile.mockRejectedValue(new Error('Execution failed'));

      service = new TranscriptionService({
        useLocalFirst: true,
      });

      const result = await (service as any).transcribeWithWhisperCpp('/path/to/audio.wav');

      expect(result.success).toBe(false);
      expect(result.error).toContain('failed');
      expect(result.provider).toBe('whisper.cpp');
    });

    it('should use custom whisper path from config', async () => {
      const customPath = '/custom/whisper-cpp';
      
      setupFsMock({
        'custom/whisper-cpp': true,
        'ggml': true,
        'transcription_': true,
      });

      mockExecFile.mockResolvedValue({
        stdout: 'Test',
        stderr: '',
      });
      mockReadFileSync.mockReturnValue('Test');

      service = new TranscriptionService({
        useLocalFirst: true,
        whisperCppPath: customPath,
      });

      await (service as any).transcribeWithWhisperCpp('/path/to/audio.wav');

      expect(mockExecFile).toHaveBeenCalledWith(
        customPath,
        expect.any(Array),
        expect.any(Object)
      );
    });

    it('should use custom model path from config', async () => {
      const customModelPath = '/custom/model.bin';
      
      setupFsMock({
        'whisper-cpp': true,
        'custom/model.bin': true,
        'transcription_': true,
      });

      mockExecFile.mockResolvedValue({
        stdout: 'Test',
        stderr: '',
      });
      mockReadFileSync.mockReturnValue('Test');

      service = new TranscriptionService({
        useLocalFirst: true,
        whisperModelPath: customModelPath,
      });

      await (service as any).transcribeWithWhisperCpp('/path/to/audio.wav');

      expect(mockExecFile).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(['-m', customModelPath]),
        expect.any(Object)
      );
    });

    it('should return empty result error when no transcription output', async () => {
      setupFsMock({
        'whisper-cpp': true,
        'ggml': true,
        'transcription_': false,
      });

      mockExecFile.mockResolvedValue({
        stdout: '',
        stderr: '',
      });

      service = new TranscriptionService({
        useLocalFirst: true,
      });

      const result = await (service as any).transcribeWithWhisperCpp('/path/to/audio.wav');

      expect(result.success).toBe(false);
      expect(result.error).toContain('No transcription output');
    });

    it('should use configured language', async () => {
      setupFsMock({
        'whisper-cpp': true,
        'ggml': true,
        'transcription_': true,
      });

      mockExecFile.mockResolvedValue({
        stdout: 'Test',
        stderr: '',
      });
      mockReadFileSync.mockReturnValue('Test');

      service = new TranscriptionService({
        useLocalFirst: true,
        language: 'zh',
      });

      await (service as any).transcribeWithWhisperCpp('/path/to/audio.wav');

      expect(mockExecFile).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(['-l', 'zh']),
        expect.any(Object)
      );
    });
  });

  describe('transcribeWithCloudProvider()', () => {
    beforeEach(() => {
      mockCreateReadStream.mockReturnValue({ pipe: vi.fn() });
    });

    it('should return error when API key is missing', async () => {
      const provider: CloudProviderConfig = {
        id: 'openai',
        name: 'OpenAI',
        enabled: true,
      };

      service = new TranscriptionService({
        useLocalFirst: false,
      });

      const result = await (service as any).transcribeWithCloudProvider('/path/to/audio.wav', provider);

      expect(result.success).toBe(false);
      expect(result.error).toContain('API key not configured');
    });

    it('should successfully transcribe with OpenAI API', async () => {
      const mockText = 'OpenAI transcription result';
      
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ text: mockText }),
      });

      const provider: CloudProviderConfig = {
        id: 'openai',
        name: 'OpenAI',
        enabled: true,
        apiKey: 'sk-test',
      };

      service = new TranscriptionService({
        useLocalFirst: false,
        language: 'en',
      });

      const result = await (service as any).transcribeWithCloudProvider('/path/to/audio.wav', provider);

      expect(result.success).toBe(true);
      expect(result.text).toBe(mockText);
      expect(result.provider).toBe('openai');
    });

    it('should successfully transcribe with Groq API', async () => {
      const mockText = 'Groq transcription result';
      
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ text: mockText }),
      });

      const provider: CloudProviderConfig = {
        id: 'groq',
        name: 'Groq',
        enabled: true,
        apiKey: 'gsk-test',
      };

      service = new TranscriptionService({
        useLocalFirst: false,
      });

      const result = await (service as any).transcribeWithCloudProvider('/path/to/audio.wav', provider);

      expect(result.success).toBe(true);
      expect(result.text).toBe(mockText);
      expect(result.provider).toBe('groq');
    });

    it('should use custom base URL when provided', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ text: 'Result' }),
      });

      const provider: CloudProviderConfig = {
        id: 'openai',
        name: 'OpenAI',
        enabled: true,
        apiKey: 'sk-test',
        baseUrl: 'https://custom.openai.com/v1/audio/transcriptions',
      };

      service = new TranscriptionService({
        useLocalFirst: false,
      });

      await (service as any).transcribeWithCloudProvider('/path/to/audio.wav', provider);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://custom.openai.com/v1/audio/transcriptions',
        expect.any(Object)
      );
    });

    it('should use custom model when provided', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ text: 'Result' }),
      });

      const provider: CloudProviderConfig = {
        id: 'openai',
        name: 'OpenAI',
        enabled: true,
        apiKey: 'sk-test',
        model: 'whisper-large-v3',
      };

      service = new TranscriptionService({
        useLocalFirst: false,
      });

      await (service as any).transcribeWithCloudProvider('/path/to/audio.wav', provider);

      expect(mockFormDataAppend).toHaveBeenCalledWith('model', 'whisper-large-v3');
    });

    it('should handle 401 unauthorized error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => JSON.stringify({ error: { message: 'Invalid API key' } }),
      });

      const provider: CloudProviderConfig = {
        id: 'openai',
        name: 'OpenAI',
        enabled: true,
        apiKey: 'invalid-key',
      };

      service = new TranscriptionService({
        useLocalFirst: false,
      });

      const result = await (service as any).transcribeWithCloudProvider('/path/to/audio.wav', provider);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid API key');
    });

    it('should handle 429 rate limit error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 429,
        text: async () => JSON.stringify({ error: { message: 'Rate limit exceeded' } }),
      });

      const provider: CloudProviderConfig = {
        id: 'openai',
        name: 'OpenAI',
        enabled: true,
        apiKey: 'sk-test',
      };

      service = new TranscriptionService({
        useLocalFirst: false,
      });

      const result = await (service as any).transcribeWithCloudProvider('/path/to/audio.wav', provider);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Rate limit exceeded');
    });

    it('should handle 500 server error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
      });

      const provider: CloudProviderConfig = {
        id: 'openai',
        name: 'OpenAI',
        enabled: true,
        apiKey: 'sk-test',
      };

      service = new TranscriptionService({
        useLocalFirst: false,
      });

      const result = await (service as any).transcribeWithCloudProvider('/path/to/audio.wav', provider);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Internal Server Error');
    });

    it('should handle empty transcription response', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ text: '' }),
      });

      const provider: CloudProviderConfig = {
        id: 'openai',
        name: 'OpenAI',
        enabled: true,
        apiKey: 'sk-test',
      };

      service = new TranscriptionService({
        useLocalFirst: false,
      });

      const result = await (service as any).transcribeWithCloudProvider('/path/to/audio.wav', provider);

      expect(result.success).toBe(false);
      expect(result.error).toContain('empty transcription');
    });

    it('should handle network failure', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const provider: CloudProviderConfig = {
        id: 'openai',
        name: 'OpenAI',
        enabled: true,
        apiKey: 'sk-test',
      };

      service = new TranscriptionService({
        useLocalFirst: false,
      });

      const result = await (service as any).transcribeWithCloudProvider('/path/to/audio.wav', provider);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network error');
    });

    it('should include language in form data', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ text: 'Result' }),
      });

      const provider: CloudProviderConfig = {
        id: 'openai',
        name: 'OpenAI',
        enabled: true,
        apiKey: 'sk-test',
      };

      service = new TranscriptionService({
        useLocalFirst: false,
        language: 'zh',
      });

      await (service as any).transcribeWithCloudProvider('/path/to/audio.wav', provider);

      expect(mockFormDataAppend).toHaveBeenCalledWith('language', 'zh');
    });

    it('should use default model for unknown provider', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ text: 'Result' }),
      });

      const provider: CloudProviderConfig = {
        id: 'deepseek' as any,
        name: 'DeepSeek',
        enabled: true,
        apiKey: 'sk-test',
      };

      service = new TranscriptionService({
        useLocalFirst: false,
      });

      await (service as any).transcribeWithCloudProvider('/path/to/audio.wav', provider);

      expect(mockFormDataAppend).toHaveBeenCalledWith('model', 'whisper-1');
    });
  });

  describe('Helper methods', () => {
    describe('checkWhisper', () => {
      it('should return cached result when available', async () => {
        setupFsMock({ 'whisper-cpp': true });
        mockExecFile.mockResolvedValue({ stdout: '', stderr: '' });

        service = new TranscriptionService({
          useLocalFirst: true,
        });

        const result1 = await (service as any).checkWhisper();
        expect(result1).toBe(true);
        expect(mockExecFile).toHaveBeenCalledTimes(1);

        const result2 = await (service as any).checkWhisper();
        expect(result2).toBe(true);
        expect(mockExecFile).toHaveBeenCalledTimes(1);
      });

      it('should return false when whisper path not found', async () => {
        mockExistsSync.mockReturnValue(false);

        service = new TranscriptionService({
          useLocalFirst: true,
        });

        const result = await (service as any).checkWhisper();
        expect(result).toBe(false);
      });

      it('should return false when execFile fails', async () => {
        setupFsMock({ 'whisper-cpp': true });
        mockExecFile.mockRejectedValue(new Error('Command failed'));

        service = new TranscriptionService({
          useLocalFirst: true,
        });

        const result = await (service as any).checkWhisper();
        expect(result).toBe(false);
      });
    });

    describe('findWhisperPath', () => {
      it('should return custom path from config when it exists', () => {
        const customPath = '/custom/whisper-cpp';
        setupFsMock({ 'custom/whisper-cpp': true });

        service = new TranscriptionService({
          useLocalFirst: true,
          whisperCppPath: customPath,
        });

        const result = (service as any).findWhisperPath();
        expect(result).toBe(customPath);
      });

      it('should return null when no whisper binary found', () => {
        mockExistsSync.mockReturnValue(false);

        service = new TranscriptionService({
          useLocalFirst: true,
        });

        const result = (service as any).findWhisperPath();
        expect(result).toBeNull();
      });

      it('should find whisper in common locations', () => {
        const expectedPath = '/opt/homebrew/bin/whisper-cpp';
        setupFsMock({ 'opt/homebrew/bin/whisper-cpp': true });

        service = new TranscriptionService({
          useLocalFirst: true,
        });

        const result = (service as any).findWhisperPath();
        expect(result).toBe(expectedPath);
      });
    });

    describe('findModelPath', () => {
      it('should return custom model path from config when it exists', () => {
        const customPath = '/custom/model.bin';
        setupFsMock({ 'custom/model.bin': true });

        service = new TranscriptionService({
          useLocalFirst: true,
          whisperModelPath: customPath,
        });

        const result = (service as any).findModelPath();
        expect(result).toBe(customPath);
      });

      it('should return null when no model found', () => {
        mockExistsSync.mockReturnValue(false);
        mockGetPath.mockReturnValue('/tmp');

        service = new TranscriptionService({
          useLocalFirst: true,
        });

        const result = (service as any).findModelPath();
        expect(result).toBeNull();
      });

      it('should find model in userData models directory', () => {
        const expectedPath = '/tmp/models/ggml-base.bin';
        setupFsMock({ 'tmp/models/ggml-base.bin': true });
        mockGetPath.mockReturnValue('/tmp');

        service = new TranscriptionService({
          useLocalFirst: true,
        });

        const result = (service as any).findModelPath();
        expect(result).toBe(expectedPath);
      });
    });

    describe('parseWhisperOutput', () => {
      beforeEach(() => {
        service = new TranscriptionService({
          useLocalFirst: true,
        });
      });

      it('should extract text from whisper output', () => {
        const output = `whisper_init_from_file_with_params: loading model
[00:00:00.000 --> 00:00:05.000]  Hello world
[00:00:05.000 --> 00:00:10.000]  This is a test
output_txt: saving output to file.txt`;

        const result = (service as any).parseWhisperOutput(output);
        expect(result).toBe('Hello world This is a test');
      });

      it('should return null for empty output', () => {
        const result = (service as any).parseWhisperOutput('');
        expect(result).toBeNull();
      });

      it('should keep transcription text from timestamped lines', () => {
        const output = `[00:00:00.000 --> 00:00:05.000]  First line
Actual transcription text`;

        const result = (service as any).parseWhisperOutput(output);
        expect(result).toBe('First line Actual transcription text');
      });

      it('should skip whisper metadata lines', () => {
        const output = `whisper_init_from_file_with_params: loading model from
whisper_model_load: loading model
Actual text`;

        const result = (service as any).parseWhisperOutput(output);
        expect(result).toBe('Actual text');
      });

      it('should skip output file lines', () => {
        const output = `output_txt: saving output to file.txt
output_txt: done
Actual transcription`;

        const result = (service as any).parseWhisperOutput(output);
        expect(result).toBe('Actual transcription');
      });

      it('should skip empty lines', () => {
        const output = `
First line

Second line

`;

        const result = (service as any).parseWhisperOutput(output);
        expect(result).toBe('First line Second line');
      });

      it('should handle bracketed metadata lines', () => {
        const output = `[INFO] Loading model
Transcription text
[DEBUG] Processing complete`;

        const result = (service as any).parseWhisperOutput(output);
        expect(result).toBe('Transcription text');
      });
    });

    describe('getQuickStatus', () => {
      it('should return quick status without full check', () => {
        setupFsMock({
          'whisper-cpp': true,
          'ggml-base.bin': true,
        });

        service = new TranscriptionService({
          useLocalFirst: true,
        });

        const status = (service as any).getQuickStatus();
        expect(status.whisperInstalled).toBe(true);
        expect(status.modelAvailable).toBe(true);
      });
    });

    describe('createPlaceholderResult', () => {
      it('should create placeholder when no providers configured', async () => {
        mockExistsSync.mockReturnValue(false);

        service = new TranscriptionService({
          useLocalFirst: true,
        });

        const result = await (service as any).createPlaceholderResult('/path/to/audio.wav');

        expect(result.success).toBe(false);
        expect(result.provider).toBe('none');
      });

      it('should create placeholder with errors', async () => {
        mockExistsSync.mockReturnValue(false);

        service = new TranscriptionService({
          useLocalFirst: true,
        });

        const errors = ['Provider 1 failed', 'Provider 2 failed'];
        const result = await (service as any).createPlaceholderResult('/path/to/audio.wav', errors);

        expect(result.error).toContain('Provider 1 failed');
        expect(result.error).toContain('Provider 2 failed');
      });

      it('should provide setup instructions when whisper not installed', async () => {
        setupFsMock({
          'whisper-cpp': false,
          'ggml-base.bin': false,
        });

        service = new TranscriptionService({
          useLocalFirst: true,
        });

        const result = await (service as any).createPlaceholderResult('/path/to/audio.wav');

        expect(result.text).toContain('brew install');
      });

      it('should provide model download instructions when model not found', async () => {
        setupFsMock({
          'whisper-cpp': true,
          'ggml-base.bin': false,
        });

        service = new TranscriptionService({
          useLocalFirst: true,
        });

        const result = await (service as any).createPlaceholderResult('/path/to/audio.wav');

        expect(result.text).toContain('Download');
      });
    });

    describe('transcribeWithOpenAI (legacy)', () => {
      it('should return error when API key not configured', async () => {
        service = new TranscriptionService({
          useLocalFirst: false,
        });

        const result = await (service as any).transcribeWithOpenAI('/path/to/audio.wav');

        expect(result.success).toBe(false);
        expect(result.error).toContain('OpenAI API key not configured');
      });

      it('should use transcribeWithCloudProvider when API key is configured', async () => {
        mockFetch.mockResolvedValue({
          ok: true,
          json: async () => ({ text: 'Result' }),
        });

        service = new TranscriptionService({
          useLocalFirst: false,
          openaiApiKey: 'sk-test',
        });

        const result = await (service as any).transcribeWithOpenAI('/path/to/audio.wav');

        expect(result.success).toBe(true);
        expect(result.text).toBe('Result');
      });
    });
  });
});
