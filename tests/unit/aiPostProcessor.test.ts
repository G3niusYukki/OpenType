import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AiPostProcessor, AiPostProcessingOptions } from '../../src/main/aiPostProcessor';
import { Store, ProviderConfig } from '../../src/main/store';
import { ProviderManager } from '../../src/main/providers';

// Mock node-fetch
vi.mock('node-fetch', () => ({
  default: vi.fn(),
}));

describe('AiPostProcessor', () => {
  let processor: AiPostProcessor;
  let mockStore: {
    get: ReturnType<typeof vi.fn>;
  };
  let mockProviderManager: {
    listProviders: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockStore = {
      get: vi.fn(),
    };
    mockProviderManager = {
      listProviders: vi.fn(),
    };
    processor = new AiPostProcessor(
      mockStore as unknown as Store,
      mockProviderManager as unknown as ProviderManager
    );
  });

  describe('detectLanguage', () => {
    it('should detect Chinese text', () => {
      const text = '这是一个中文文本';
      const result = (processor as any).detectLanguage(text);
      expect(result).toBe('zh');
    });

    it('should detect English text', () => {
      const text = 'This is an English text';
      const result = (processor as any).detectLanguage(text);
      expect(result).toBe('en');
    });

    it('should detect Chinese when mixed with English', () => {
      const text = 'This is mixed 中文内容 text';
      const result = (processor as any).detectLanguage(text);
      expect(result).toBe('zh');
    });

    it('should default to English for non-Chinese text', () => {
      const text = 'Hola mundo こんにちは';
      const result = (processor as any).detectLanguage(text);
      expect(result).toBe('en');
    });

    it('should detect Chinese punctuation', () => {
      const text = '你好，世界。';
      const result = (processor as any).detectLanguage(text);
      expect(result).toBe('zh');
    });
  });

  describe('buildPrompt', () => {
    it('should build Chinese prompt with all options enabled', () => {
      const options: AiPostProcessingOptions = {
        removeFillerWords: true,
        removeRepetition: true,
        detectSelfCorrection: true,
        language: 'zh',
      };

      const prompt = (processor as any).buildPrompt('测试文本', options);
      
      expect(prompt).toContain('删除填充词');
      expect(prompt).toContain('删除重复词语');
      expect(prompt).toContain('检测自我修正');
      expect(prompt).toContain('中文');
    });

    it('should build English prompt with all options enabled', () => {
      const options: AiPostProcessingOptions = {
        removeFillerWords: true,
        removeRepetition: true,
        detectSelfCorrection: true,
        language: 'en',
      };

      const prompt = (processor as any).buildPrompt('Test text', options);
      
      expect(prompt).toContain('Remove filler words');
      expect(prompt).toContain('Remove repeated words');
      expect(prompt).toContain('Detect self-corrections');
      expect(prompt).toContain('professional');
    });

    it('should auto-detect language when set to auto', () => {
      const options: AiPostProcessingOptions = {
        removeFillerWords: true,
        removeRepetition: false,
        detectSelfCorrection: false,
        language: 'auto',
      };

      const prompt = (processor as any).buildPrompt('这是一个中文测试', options);
      
      expect(prompt).toContain('删除填充词');
      expect(prompt).not.toContain('Remove filler words');
    });

    it('should exclude disabled options from prompt', () => {
      const options: AiPostProcessingOptions = {
        removeFillerWords: false,
        removeRepetition: false,
        detectSelfCorrection: true,
        language: 'en',
      };

      const prompt = (processor as any).buildPrompt('Test', options);
      
      expect(prompt).not.toContain('filler words');
      expect(prompt).not.toContain('repeated');
      expect(prompt).toContain('self-corrections');
    });
  });

  describe('isAvailable', () => {
    it('should return true when AI provider is configured', () => {
      const providers: ProviderConfig[] = [
        { id: 'openai', name: 'OpenAI', enabled: true, apiKey: 'sk-test' },
      ];
      mockStore.get.mockReturnValue(providers);

      expect(processor.isAvailable()).toBe(true);
    });

    it('should return false when no provider enabled', () => {
      const providers: ProviderConfig[] = [
        { id: 'openai', name: 'OpenAI', enabled: false, apiKey: 'sk-test' },
      ];
      mockStore.get.mockReturnValue(providers);

      expect(processor.isAvailable()).toBe(false);
    });

    it('should return false when provider has no API key', () => {
      const providers: ProviderConfig[] = [
        { id: 'openai', name: 'OpenAI', enabled: true },
      ];
      mockStore.get.mockReturnValue(providers);

      expect(processor.isAvailable()).toBe(false);
    });

    it('should return false when providers array is empty', () => {
      mockStore.get.mockReturnValue([]);
      expect(processor.isAvailable()).toBe(false);
    });

    it('should check enabledForPostProcessing field first', () => {
      const providers: ProviderConfig[] = [
        { 
          id: 'openai', 
          name: 'OpenAI', 
          enabled: true, 
          enabledForPostProcessing: false,
          apiKey: 'sk-test' 
        },
      ];
      mockStore.get.mockReturnValue(providers);

      expect(processor.isAvailable()).toBe(false);
    });

    it('should support multiple AI providers', () => {
      const testCases = [
        { id: 'deepseek', name: 'DeepSeek', enabled: true, apiKey: 'test' },
        { id: 'zhipu', name: '智谱', enabled: true, apiKey: 'test' },
        { id: 'minimax', name: 'MiniMax', enabled: true, apiKey: 'test' },
        { id: 'moonshot', name: 'Kimi', enabled: true, apiKey: 'test' },
      ];

      for (const provider of testCases) {
        mockStore.get.mockReturnValue([provider]);
        expect(processor.isAvailable()).toBe(true);
      }
    });

    it('should not support transcription-only providers', () => {
      const providers: ProviderConfig[] = [
        { id: 'aliyun-asr', name: '阿里云', enabled: true, apiKey: 'test' },
      ];
      mockStore.get.mockReturnValue(providers);

      expect(processor.isAvailable()).toBe(false);
    });
  });

  describe('getActiveAiProvider', () => {
    it('should return first enabled provider', () => {
      const providers: ProviderConfig[] = [
        { id: 'openai', name: 'OpenAI', enabled: false, apiKey: 'sk-test' },
        { id: 'deepseek', name: 'DeepSeek', enabled: true, apiKey: 'test' },
      ];
      mockStore.get.mockReturnValue(providers);

      const provider = (processor as any).getActiveAiProvider();
      expect(provider?.id).toBe('deepseek');
    });

    it('should return null when no valid provider', () => {
      mockStore.get.mockReturnValue([]);
      const provider = (processor as any).getActiveAiProvider();
      expect(provider).toBeNull();
    });
  });

  describe('process', () => {
    it('should return error when no provider available', async () => {
      mockStore.get.mockReturnValue([]);

      const result = await processor.process('Test text');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('No AI provider configured');
      expect(result.processedText).toBe('Test text');
    });
  });

  describe('translate', () => {
    it('should return error when no provider available', async () => {
      mockStore.get.mockReturnValue([]);

      const result = await processor.translate('Hello', 'en', 'zh');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('No AI provider configured');
    });
  });

  describe('editText', () => {
    it('should return error when no provider available', async () => {
      mockStore.get.mockReturnValue([]);

      const result = await processor.editText('Original text', 'Make it formal');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('No AI provider configured');
    });
  });
});