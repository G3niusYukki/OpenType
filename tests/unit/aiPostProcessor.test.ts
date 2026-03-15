import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { AiPostProcessor, AiPostProcessingOptions, TextChange } from '../../src/main/aiPostProcessor';
import { Store, ProviderConfig } from '../../src/main/store';
import { ProviderManager } from '../../src/main/providers';

const mockFetch = vi.fn();
(global as any).fetch = mockFetch;

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

  afterEach(() => {
    vi.restoreAllMocks();
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
      expect(prompt).toContain('优化规则');
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

  describe('Provider API - OpenAI', () => {
    const openAIProvider: ProviderConfig = {
      id: 'openai',
      name: 'OpenAI',
      enabled: true,
      apiKey: 'sk-test',
    };

    it('should successfully call OpenAI API', async () => {
      mockStore.get.mockReturnValue([openAIProvider]);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Processed text' } }],
          model: 'gpt-3.5-turbo',
        }),
      });

      const result = await processor.process('Test text');

      expect(result.success).toBe(true);
      expect(result.processedText).toBe('Processed text');
      expect(result.provider).toBe('OpenAI');
      expect(result.model).toBe('gpt-3.5-turbo');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer sk-test',
          }),
        })
      );
    });

    it('should handle OpenAI 401 error', async () => {
      mockStore.get.mockReturnValue([openAIProvider]);
      mockFetch.mockResolvedValueOnce({
        ok: false,
        text: async () => 'Unauthorized',
      });

      const result = await processor.process('Test text');

      expect(result.success).toBe(false);
      expect(result.error).toContain('OpenAI API error');
    });

    it('should handle OpenAI 429 rate limit error', async () => {
      mockStore.get.mockReturnValue([openAIProvider]);
      mockFetch.mockResolvedValueOnce({
        ok: false,
        text: async () => 'Rate limit exceeded',
      });

      const result = await processor.process('Test text');

      expect(result.success).toBe(false);
      expect(result.error).toContain('OpenAI API error');
    });

    it('should handle OpenAI 500 server error', async () => {
      mockStore.get.mockReturnValue([openAIProvider]);
      mockFetch.mockResolvedValueOnce({
        ok: false,
        text: async () => 'Internal server error',
      });

      const result = await processor.process('Test text');

      expect(result.success).toBe(false);
      expect(result.error).toContain('OpenAI API error');
    });

    it('should handle network failure', async () => {
      mockStore.get.mockReturnValue([openAIProvider]);
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await processor.process('Test text');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network error');
    });

    it('should handle malformed response', async () => {
      mockStore.get.mockReturnValue([openAIProvider]);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ invalid: 'response' }),
      });

      const result = await processor.process('Test text');

      expect(result.success).toBe(false);
      expect(result.processedText).toBe('Test text');
    });

    it('should use custom baseUrl when configured', async () => {
      const customProvider = { ...openAIProvider, baseUrl: 'https://custom.openai.com/v1' };
      mockStore.get.mockReturnValue([customProvider]);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Processed' } }],
          model: 'gpt-4',
        }),
      });

      await processor.process('Test');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://custom.openai.com/v1',
        expect.any(Object)
      );
    });

    it('should use custom model when configured', async () => {
      const customProvider = { ...openAIProvider, model: 'gpt-4-turbo' };
      mockStore.get.mockReturnValue([customProvider]);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Processed' } }],
          model: 'gpt-4-turbo',
        }),
      });

      const result = await processor.process('Test');

      expect(result.model).toBe('gpt-4-turbo');
    });
  });

  describe('Provider API - Groq', () => {
    const groqProvider: ProviderConfig = {
      id: 'groq',
      name: 'Groq',
      enabled: true,
      apiKey: 'gsk-test',
    };

    it('should successfully call Groq API', async () => {
      mockStore.get.mockReturnValue([groqProvider]);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Processed by Groq' } }],
          model: 'llama-3.3-70b',
        }),
      });

      const result = await processor.process('Test text');

      expect(result.success).toBe(true);
      expect(result.processedText).toBe('Processed by Groq');
      expect(result.provider).toBe('Groq');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.groq.com/openai/v1/chat/completions',
        expect.any(Object)
      );
    });

    it('should handle Groq API error', async () => {
      mockStore.get.mockReturnValue([groqProvider]);
      mockFetch.mockResolvedValueOnce({
        ok: false,
        text: async () => 'API Error',
      });

      const result = await processor.process('Test text');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Groq API error');
    });
  });

  describe('Provider API - Anthropic', () => {
    const anthropicProvider: ProviderConfig = {
      id: 'anthropic',
      name: 'Anthropic',
      enabled: true,
      apiKey: 'sk-ant-test',
    };

    it('should successfully call Anthropic API', async () => {
      mockStore.get.mockReturnValue([anthropicProvider]);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ text: 'Processed by Claude' }],
          model: 'claude-3-sonnet',
        }),
      });

      const result = await processor.process('Test text');

      expect(result.success).toBe(true);
      expect(result.processedText).toBe('Processed by Claude');
      expect(result.provider).toBe('Anthropic');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.anthropic.com/v1/messages',
        expect.objectContaining({
          headers: expect.objectContaining({
            'x-api-key': 'sk-ant-test',
            'anthropic-version': '2023-06-01',
          }),
        })
      );
    });

    it('should handle Anthropic API error', async () => {
      mockStore.get.mockReturnValue([anthropicProvider]);
      mockFetch.mockResolvedValueOnce({
        ok: false,
        text: async () => 'API Error',
      });

      const result = await processor.process('Test text');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Anthropic API error');
    });

    it('should use default model when not specified', async () => {
      mockStore.get.mockReturnValue([anthropicProvider]);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ text: 'Processed' }],
          model: 'claude-3-sonnet-20240229',
        }),
      });

      await processor.process('Test');

      const callArgs = mockFetch.mock.calls[0][1];
      const body = JSON.parse(callArgs.body);
      expect(body.model).toBe('claude-3-sonnet-20240229');
    });
  });

  describe('Provider API - DeepSeek', () => {
    const deepseekProvider: ProviderConfig = {
      id: 'deepseek',
      name: 'DeepSeek',
      enabled: true,
      apiKey: 'sk-deepseek-test',
    };

    it('should successfully call DeepSeek API', async () => {
      mockStore.get.mockReturnValue([deepseekProvider]);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Processed by DeepSeek' } }],
          model: 'deepseek-chat',
        }),
      });

      const result = await processor.process('Test text');

      expect(result.success).toBe(true);
      expect(result.processedText).toBe('Processed by DeepSeek');
      expect(result.provider).toBe('DeepSeek');
    });

    it('should handle DeepSeek API error', async () => {
      mockStore.get.mockReturnValue([deepseekProvider]);
      mockFetch.mockResolvedValueOnce({
        ok: false,
        text: async () => 'API Error',
      });

      const result = await processor.process('Test text');

      expect(result.success).toBe(false);
      expect(result.error).toContain('DeepSeek API error');
    });

    it('should use custom baseUrl when configured', async () => {
      const customProvider = { ...deepseekProvider, baseUrl: 'https://custom.deepseek.com/v1' };
      mockStore.get.mockReturnValue([customProvider]);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Processed' } }],
          model: 'deepseek-chat',
        }),
      });

      await processor.process('Test');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://custom.deepseek.com/v1',
        expect.any(Object)
      );
    });
  });

  describe('Provider API - Zhipu', () => {
    const zhipuProvider: ProviderConfig = {
      id: 'zhipu',
      name: '智谱',
      enabled: true,
      apiKey: 'sk-zhipu-test',
    };

    it('should successfully call Zhipu API', async () => {
      mockStore.get.mockReturnValue([zhipuProvider]);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '智谱处理结果' } }],
          model: 'glm-4',
        }),
      });

      const result = await processor.process('测试文本');

      expect(result.success).toBe(true);
      expect(result.processedText).toBe('智谱处理结果');
      expect(result.provider).toBe('智谱 GLM');
    });

    it('should handle Zhipu API error', async () => {
      mockStore.get.mockReturnValue([zhipuProvider]);
      mockFetch.mockResolvedValueOnce({
        ok: false,
        text: async () => 'API Error',
      });

      const result = await processor.process('测试');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Zhipu API error');
    });

    it('should use default GLM model', async () => {
      mockStore.get.mockReturnValue([zhipuProvider]);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Processed' } }],
          model: 'glm-4',
        }),
      });

      await processor.process('Test');

      const callArgs = mockFetch.mock.calls[0][1];
      const body = JSON.parse(callArgs.body);
      expect(body.model).toBe('glm-4');
    });
  });

  describe('Provider API - MiniMax', () => {
    const minimaxProvider: ProviderConfig = {
      id: 'minimax',
      name: 'MiniMax',
      enabled: true,
      apiKey: 'sk-minimax-test',
    };

    it('should successfully call MiniMax API', async () => {
      mockStore.get.mockReturnValue([minimaxProvider]);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'MiniMax processed' } }],
          model: 'abab6.5s-chat',
        }),
      });

      const result = await processor.process('Test text');

      expect(result.success).toBe(true);
      expect(result.processedText).toBe('MiniMax processed');
      expect(result.provider).toBe('MiniMax');
    });

    it('should handle MiniMax API error', async () => {
      mockStore.get.mockReturnValue([minimaxProvider]);
      mockFetch.mockResolvedValueOnce({
        ok: false,
        text: async () => 'API Error',
      });

      const result = await processor.process('Test');

      expect(result.success).toBe(false);
      expect(result.error).toContain('MiniMax API error');
    });
  });

  describe('Provider API - Moonshot', () => {
    const moonshotProvider: ProviderConfig = {
      id: 'moonshot',
      name: 'Kimi',
      enabled: true,
      apiKey: 'sk-moonshot-test',
    };

    it('should successfully call Moonshot API', async () => {
      mockStore.get.mockReturnValue([moonshotProvider]);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Kimi processed' } }],
          model: 'moonshot-v1-8k',
        }),
      });

      const result = await processor.process('Test text');

      expect(result.success).toBe(true);
      expect(result.processedText).toBe('Kimi processed');
      expect(result.provider).toBe('Kimi');
    });

    it('should handle Moonshot API error', async () => {
      mockStore.get.mockReturnValue([moonshotProvider]);
      mockFetch.mockResolvedValueOnce({
        ok: false,
        text: async () => 'API Error',
      });

      const result = await processor.process('Test');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Moonshot API error');
    });

    it('should use default Moonshot model', async () => {
      mockStore.get.mockReturnValue([moonshotProvider]);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Processed' } }],
          model: 'moonshot-v1-8k',
        }),
      });

      await processor.process('Test');

      const callArgs = mockFetch.mock.calls[0][1];
      const body = JSON.parse(callArgs.body);
      expect(body.model).toBe('moonshot-v1-8k');
    });
  });

  describe('process() method', () => {
    const openAIProvider: ProviderConfig = {
      id: 'openai',
      name: 'OpenAI',
      enabled: true,
      apiKey: 'sk-test',
    };

    it('should return error when no provider available', async () => {
      mockStore.get.mockReturnValue([]);

      const result = await processor.process('Test text');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('No AI provider configured');
      expect(result.processedText).toBe('Test text');
    });

    it('should successfully process with default options', async () => {
      mockStore.get.mockReturnValue([openAIProvider]);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Processed text' } }],
          model: 'gpt-3.5-turbo',
        }),
      });

      const result = await processor.process('Test text');

      expect(result.success).toBe(true);
      expect(result.originalText).toBe('Test text');
      expect(result.processedText).toBe('Processed text');
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it('should pass custom options to provider', async () => {
      mockStore.get.mockReturnValue([openAIProvider]);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Processed' } }],
          model: 'gpt-3.5-turbo',
        }),
      });

      await processor.process('Test', {
        removeFillerWords: false,
        removeRepetition: true,
        detectSelfCorrection: false,
        language: 'en',
      });

      expect(mockFetch).toHaveBeenCalled();
    });

    it('should track latency', async () => {
      mockStore.get.mockReturnValue([openAIProvider]);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Processed' } }],
          model: 'gpt-3.5-turbo',
        }),
      });

      const result = await processor.process('Test');

      expect(result.latencyMs).toBeDefined();
      expect(typeof result.latencyMs).toBe('number');
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it('should handle empty content in response', async () => {
      mockStore.get.mockReturnValue([openAIProvider]);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '' } }],
          model: 'gpt-3.5-turbo',
        }),
      });

      const result = await processor.process('Original text');

      expect(result.success).toBe(true);
      expect(result.processedText).toBe('Original text');
    });

    it('should handle missing choices in response', async () => {
      mockStore.get.mockReturnValue([openAIProvider]);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [],
          model: 'gpt-3.5-turbo',
        }),
      });

      const result = await processor.process('Original text');

      expect(result.success).toBe(true);
      expect(result.processedText).toBe('Original text');
    });

    it('should process with all providers', async () => {
      const providers = [
        { id: 'openai', name: 'OpenAI', apiKey: 'test' },
        { id: 'groq', name: 'Groq', apiKey: 'test' },
        { id: 'anthropic', name: 'Anthropic', apiKey: 'test' },
        { id: 'deepseek', name: 'DeepSeek', apiKey: 'test' },
        { id: 'zhipu', name: 'Zhipu', apiKey: 'test' },
        { id: 'minimax', name: 'MiniMax', apiKey: 'test' },
        { id: 'moonshot', name: 'Moonshot', apiKey: 'test' },
      ];

      for (const provider of providers) {
        mockStore.get.mockReturnValue([{ ...provider, enabled: true }]);
        
        if (provider.id === 'anthropic') {
          mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({
              content: [{ text: 'Processed' }],
              model: 'claude-3',
            }),
          });
        } else {
          mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({
              choices: [{ message: { content: 'Processed' } }],
              model: 'test-model',
            }),
          });
        }

        const result = await processor.process('Test');
        expect(result.success).toBe(true);
        vi.clearAllMocks();
      }
    });
  });

  describe('translate() method', () => {
    const openAIProvider: ProviderConfig = {
      id: 'openai',
      name: 'OpenAI',
      enabled: true,
      apiKey: 'sk-test',
    };

    it('should return error when no provider available', async () => {
      mockStore.get.mockReturnValue([]);

      const result = await processor.translate('Hello', 'en', 'zh');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('No AI provider configured');
    });

    it('should translate zh→en', async () => {
      mockStore.get.mockReturnValue([openAIProvider]);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Hello world' } }],
          model: 'gpt-3.5-turbo',
        }),
      });

      const result = await processor.translate('你好世界', 'zh', 'en');

      expect(result.success).toBe(true);
      expect(result.processedText).toBe('Hello world');
      expect(result.originalText).toBe('你好世界');
    });

    it('should translate en→zh', async () => {
      mockStore.get.mockReturnValue([openAIProvider]);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '你好世界' } }],
          model: 'gpt-3.5-turbo',
        }),
      });

      const result = await processor.translate('Hello world', 'en', 'zh');

      expect(result.success).toBe(true);
      expect(result.processedText).toBe('你好世界');
    });

    it('should handle translation API error', async () => {
      mockStore.get.mockReturnValue([openAIProvider]);
      mockFetch.mockResolvedValueOnce({
        ok: false,
        text: async () => 'Translation failed',
      });

      const result = await processor.translate('Hello', 'en', 'zh');

      expect(result.success).toBe(false);
      expect(result.error).toContain('OpenAI API error');
    });

    it('should handle network error during translation', async () => {
      mockStore.get.mockReturnValue([openAIProvider]);
      mockFetch.mockRejectedValueOnce(new Error('Network timeout'));

      const result = await processor.translate('Hello', 'en', 'zh');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network timeout');
    });

    it('should use Anthropic for translation', async () => {
      const anthropicProvider: ProviderConfig = {
        id: 'anthropic',
        name: 'Anthropic',
        enabled: true,
        apiKey: 'sk-ant-test',
      };
      mockStore.get.mockReturnValue([anthropicProvider]);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ text: 'Translated text' }],
          model: 'claude-3-sonnet',
        }),
      });

      const result = await processor.translate('Hello', 'en', 'zh');

      expect(result.success).toBe(true);
      expect(result.processedText).toBe('Translated text');
    });
  });

  describe('editText() method', () => {
    const openAIProvider: ProviderConfig = {
      id: 'openai',
      name: 'OpenAI',
      enabled: true,
      apiKey: 'sk-test',
    };

    it('should return error when no provider available', async () => {
      mockStore.get.mockReturnValue([]);

      const result = await processor.editText('Original text', 'Make it formal');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('No AI provider configured');
    });

    it('should successfully edit text based on command', async () => {
      mockStore.get.mockReturnValue([openAIProvider]);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Formal version of text' } }],
          model: 'gpt-3.5-turbo',
        }),
      });

      const result = await processor.editText('Hey, whats up?', 'Make it formal');

      expect(result.success).toBe(true);
      expect(result.processedText).toBe('Formal version of text');
      expect(result.originalText).toBe('Hey, whats up?');
    });

    it('should handle edit API error', async () => {
      mockStore.get.mockReturnValue([openAIProvider]);
      mockFetch.mockResolvedValueOnce({
        ok: false,
        text: async () => 'Edit failed',
      });

      const result = await processor.editText('Text', 'Make it better');

      expect(result.success).toBe(false);
      expect(result.error).toContain('OpenAI API error');
    });

    it('should handle network error during edit', async () => {
      mockStore.get.mockReturnValue([openAIProvider]);
      mockFetch.mockRejectedValueOnce(new Error('Connection failed'));

      const result = await processor.editText('Text', 'Fix grammar');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Connection failed');
    });

    it('should include command in prompt', async () => {
      mockStore.get.mockReturnValue([openAIProvider]);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Result' } }],
          model: 'gpt-3.5-turbo',
        }),
      });

      await processor.editText('Original', 'Translate to Chinese');

      expect(mockFetch).toHaveBeenCalled();
      const callArgs = mockFetch.mock.calls[0][1];
      const body = JSON.parse(callArgs.body);
      expect(body.messages[0].content).toContain('Translate to Chinese');
    });
  });

  describe('computeChanges() method', () => {
    it('should detect Chinese filler word removal', () => {
      const original = '嗯，这个啊，我们需要那个讨论一下';
      const processed = '我们需要讨论一下';

      const changes: TextChange[] = (processor as any).computeChanges(original, processed);

      expect(changes.length).toBeGreaterThan(0);
      expect(changes.some((c: TextChange) => c.type === 'filler')).toBe(true);
    });

    it('should detect English filler word removal', () => {
      const original = 'Um, I uh, like, need to well, discuss this';
      const processed = 'I need to discuss this';

      const changes: TextChange[] = (processor as any).computeChanges(original, processed);

      expect(changes.length).toBeGreaterThan(0);
      expect(changes.some((c: TextChange) => c.type === 'filler' && c.original === 'um')).toBe(true);
    });

    it('should detect "uh" filler word removal', () => {
      const original = 'Uh, I think we should uh, go ahead';
      const processed = 'I think we should go ahead';

      const changes: TextChange[] = (processor as any).computeChanges(original, processed);

      expect(changes.some((c: TextChange) => c.original === 'uh')).toBe(true);
    });

    it('should detect "like" filler word removal', () => {
      const original = 'I like, really like this idea';
      const processed = 'I really enjoy this idea';

      const changes: TextChange[] = (processor as any).computeChanges(original, processed);

      expect(changes.some((c: TextChange) => c.original === 'like')).toBe(true);
    });

    it('should detect "you know" filler phrase removal', () => {
      const original = 'This is, you know, really important';
      const processed = 'This is really important';

      const changes: TextChange[] = (processor as any).computeChanges(original, processed);

      expect(changes.some((c: TextChange) => c.original === 'you know')).toBe(true);
    });

    it('should detect "well" filler word removal', () => {
      const original = 'Well, I think we should start';
      const processed = 'I think we should start';

      const changes: TextChange[] = (processor as any).computeChanges(original, processed);

      expect(changes.some((c: TextChange) => c.original === 'well')).toBe(true);
    });

    it('should detect multiple Chinese filler words', () => {
      const original = '嗯，啊，那个，就是，然后，我们需要所以讨论一下对吧';
      const processed = '我们需要讨论一下';

      const changes: TextChange[] = (processor as any).computeChanges(original, processed);

      const fillerChanges = changes.filter((c: TextChange) => c.type === 'filler');
      expect(fillerChanges.length).toBeGreaterThan(0);
    });

    it('should mark general improvement when text changed but no specific pattern detected', () => {
      const original = 'This is some text that needs improvement';
      const processed = 'This text has been significantly improved and polished';

      const changes: TextChange[] = (processor as any).computeChanges(original, processed);

      expect(changes.length).toBe(1);
      expect(changes[0].type).toBe('improvement');
      expect(changes[0].explanation).toBe('Text polished for better flow');
    });

    it('should return empty array when text is identical', () => {
      const original = 'This text is exactly the same';
      const processed = 'This text is exactly the same';

      const changes: TextChange[] = (processor as any).computeChanges(original, processed);

      expect(changes).toEqual([]);
    });

    it('should truncate long text in improvement description', () => {
      const original = 'A'.repeat(100);
      const processed = 'B'.repeat(100);

      const changes: TextChange[] = (processor as any).computeChanges(original, processed);

      expect(changes.length).toBe(1);
      expect(changes[0].type).toBe('improvement');
      expect(changes[0].original?.length).toBeLessThan(original.length);
      expect(changes[0].original?.endsWith('...')).toBe(true);
    });

    it('should handle empty strings', () => {
      const changes: TextChange[] = (processor as any).computeChanges('', '');
      expect(changes).toEqual([]);
    });

    it('should handle partial filler word matches correctly', () => {
      const original = 'The likelihood of success is high';
      const processed = 'Success is likely';

      const changes: TextChange[] = (processor as any).computeChanges(original, processed);

      expect(changes.some((c: TextChange) => c.original === 'like')).toBe(false);
    });
  });

  describe('Provider configuration', () => {
    it('should use custom baseUrl for all providers', async () => {
      const providers = [
        { id: 'openai', name: 'OpenAI', enabled: true, apiKey: 'test', baseUrl: 'https://custom.openai.com' },
        { id: 'deepseek', name: 'DeepSeek', enabled: true, apiKey: 'test', baseUrl: 'https://custom.deepseek.com' },
        { id: 'zhipu', name: 'Zhipu', enabled: true, apiKey: 'test', baseUrl: 'https://custom.zhipu.com' },
        { id: 'minimax', name: 'MiniMax', enabled: true, apiKey: 'test', baseUrl: 'https://custom.minimax.com' },
        { id: 'moonshot', name: 'Moonshot', enabled: true, apiKey: 'test', baseUrl: 'https://custom.moonshot.com' },
      ];

      for (const provider of providers) {
        mockStore.get.mockReturnValue([provider]);
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            choices: [{ message: { content: 'Processed' } }],
            model: 'test',
          }),
        });

        await processor.process('Test');

        expect(mockFetch).toHaveBeenCalledWith(
          provider.baseUrl,
          expect.any(Object)
        );
        vi.clearAllMocks();
      }
    });

    it('should use default URLs when baseUrl not specified', async () => {
      const testCases = [
        { id: 'openai', expectedUrl: 'https://api.openai.com/v1/chat/completions' },
        { id: 'deepseek', expectedUrl: 'https://api.deepseek.com/v1/chat/completions' },
        { id: 'zhipu', expectedUrl: 'https://open.bigmodel.cn/api/paas/v4/chat/completions' },
        { id: 'minimax', expectedUrl: 'https://api.minimax.chat/v1/text/chatcompletion_v2' },
        { id: 'moonshot', expectedUrl: 'https://api.moonshot.cn/v1/chat/completions' },
        { id: 'groq', expectedUrl: 'https://api.groq.com/openai/v1/chat/completions' },
      ];

      for (const testCase of testCases) {
        mockStore.get.mockReturnValue([{
          id: testCase.id,
          name: testCase.id,
          enabled: true,
          apiKey: 'test',
        }]);
        
        if (testCase.id === 'anthropic') {
          mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ content: [{ text: 'Processed' }] }),
          });
        } else {
          mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({
              choices: [{ message: { content: 'Processed' } }],
            }),
          });
        }

        await processor.process('Test');

        expect(mockFetch).toHaveBeenCalledWith(
          testCase.expectedUrl,
          expect.any(Object)
        );
        vi.clearAllMocks();
      }
    });

    it('should validate API key presence', () => {
      const providers: ProviderConfig[] = [
        { id: 'openai', name: 'OpenAI', enabled: true },
      ];
      mockStore.get.mockReturnValue(providers);

      expect(processor.isAvailable()).toBe(false);
    });

    it('should support custom model selection for each provider', async () => {
      const models: Record<string, string> = {
        openai: 'gpt-4-turbo',
        groq: 'llama-3.1-70b',
        anthropic: 'claude-3-opus',
        deepseek: 'deepseek-coder',
        zhipu: 'glm-4-flash',
        minimax: 'abab6-chat',
        moonshot: 'moonshot-v1-32k',
      };

      for (const [providerId, model] of Object.entries(models)) {
        mockStore.get.mockReturnValue([{
          id: providerId,
          name: providerId,
          enabled: true,
          apiKey: 'test',
          model,
        }]);

        if (providerId === 'anthropic') {
          mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ content: [{ text: 'Processed' }], model }),
          });
        } else {
          mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({
              choices: [{ message: { content: 'Processed' } }],
              model,
            }),
          });
        }

        await processor.process('Test');

        const callArgs = mockFetch.mock.calls[0][1];
        const body = JSON.parse(callArgs.body);
        expect(body.model).toBe(model);
        vi.clearAllMocks();
      }
    });
  });

  describe('Error handling edge cases', () => {
    it('should handle null error message', async () => {
      mockStore.get.mockReturnValue([{
        id: 'openai',
        name: 'OpenAI',
        enabled: true,
        apiKey: 'test',
      }]);
      mockFetch.mockRejectedValueOnce(null);

      const result = await processor.process('Test');

      expect(result.success).toBe(false);
      expect(result.error).toBe('AI processing failed');
    });

    it('should handle undefined error', async () => {
      mockStore.get.mockReturnValue([{
        id: 'openai',
        name: 'OpenAI',
        enabled: true,
        apiKey: 'test',
      }]);
      mockFetch.mockRejectedValueOnce(undefined);

      const result = await processor.process('Test');

      expect(result.success).toBe(false);
      expect(result.error).toBe('AI processing failed');
    });

    it('should handle error without message property', async () => {
      mockStore.get.mockReturnValue([{
        id: 'openai',
        name: 'OpenAI',
        enabled: true,
        apiKey: 'test',
      }]);
      mockFetch.mockRejectedValueOnce({ code: 500, status: 'error' });

      const result = await processor.process('Test');

      expect(result.success).toBe(false);
      expect(result.error).toBe('AI processing failed');
    });

    it('should handle provider without providers array', () => {
      mockStore.get.mockReturnValue(undefined);
      expect(processor.isAvailable()).toBe(false);
    });
  });

  describe('Unsupported provider', () => {
    it('should filter out unsupported providers', async () => {
      mockStore.get.mockReturnValue([{
        id: 'unsupported-provider',
        name: 'Unsupported',
        enabled: true,
        apiKey: 'test',
      }]);

      const result = await processor.process('Test');

      expect(result.success).toBe(false);
      expect(result.error).toContain('No AI provider configured');
    });
  });
});
