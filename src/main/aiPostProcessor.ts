import { ProviderManager } from './providers';
import { Store } from './store';

export interface AiPostProcessingOptions {
  removeFillerWords: boolean;
  removeRepetition: boolean;
  detectSelfCorrection: boolean;
  language: 'zh' | 'en' | 'auto';
}

export interface TextChange {
  type: 'filler' | 'repetition' | 'correction' | 'improvement';
  original: string;
  replacement: string;
  position: number;
  explanation?: string;
}

export interface AiPostProcessingResult {
  success: boolean;
  originalText: string;
  processedText: string;
  changes: TextChange[];
  provider: string;
  model?: string;
  error?: string;
  latencyMs: number;
}

interface ProviderConfig {
  id: string;
  name: string;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  enabled: boolean;
}

/**
 * AI Post-Processor Service
 * 
 * Transforms raw transcribed text into polished, professional text by:
 * 1. Removing filler words (um, uh, 嗯, 啊, etc.)
 * 2. Removing repetition ("你好你好" → "你好")
 * 3. Detecting and applying self-corrections
 * 4. Improving flow and readability
 */
export class AiPostProcessor {
  private store: Store;
  private providerManager: ProviderManager;

  constructor(store: Store, providerManager: ProviderManager) {
    this.store = store;
    this.providerManager = providerManager;
  }

  /**
   * Process text through AI post-processing
   */
  async process(
    text: string,
    options?: Partial<AiPostProcessingOptions>
  ): Promise<AiPostProcessingResult> {
    const startTime = Date.now();
    const defaultOptions: AiPostProcessingOptions = {
      removeFillerWords: true,
      removeRepetition: true,
      detectSelfCorrection: true,
      language: 'auto',
    };
    const opts = { ...defaultOptions, ...options };

    // Get AI-capable provider
    const provider = this.getActiveAiProvider();
    if (!provider) {
      return {
        success: false,
        originalText: text,
        processedText: text,
        changes: [],
        provider: 'none',
        error: 'No AI provider configured. Please enable OpenAI, Groq, or Anthropic in settings.',
        latencyMs: Date.now() - startTime,
      };
    }

    try {
      const result = await this.callAiProvider(text, opts, provider);
      return {
        ...result,
        latencyMs: Date.now() - startTime,
      };
    } catch (error: any) {
      console.error('[AiPostProcessor] Processing failed:', error);
      return {
        success: false,
        originalText: text,
        processedText: text,
        changes: [],
        provider: provider.name,
        error: error?.message || 'AI processing failed',
        latencyMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Get the active AI provider (first enabled provider with API key)
   */
  private getActiveAiProvider(): ProviderConfig | null {
    const providers = this.store.get('providers') || [];
    const aiProvider = providers.find((p: ProviderConfig) => 
      p.enabled && p.apiKey && ['anthropic', 'openai', 'groq', 'deepseek', 'zhipu', 'minimax', 'moonshot'].includes(p.id)
    );
    return aiProvider || null;
  }

  /**
   * Check if AI post-processing is available (has configured provider)
   */
  isAvailable(): boolean {
    return this.getActiveAiProvider() !== null;
  }

  /**
   * Call AI provider with prompt
   */
  private async callAiProvider(
    text: string,
    options: AiPostProcessingOptions,
    provider: ProviderConfig
  ): Promise<Omit<AiPostProcessingResult, 'latencyMs'>> {
    const prompt = this.buildPrompt(text, options);
    
    switch (provider.id) {
      case 'openai':
        return this.callOpenAI(prompt, text, provider);
      case 'groq':
        return this.callGroq(prompt, text, provider);
      case 'anthropic':
        return this.callAnthropic(prompt, text, provider);
      case 'deepseek':
        return this.callDeepSeek(prompt, text, provider);
      case 'zhipu':
        return this.callZhipu(prompt, text, provider);
      case 'minimax':
        return this.callMiniMax(prompt, text, provider);
      case 'moonshot':
        return this.callMoonshot(prompt, text, provider);
      default:
        throw new Error(`Unsupported AI provider: ${provider.id}`);
    }
  }

  /**
   * Build the AI prompt for text processing
   */
  private buildPrompt(text: string, options: AiPostProcessingOptions): string {
    const language = options.language === 'auto' 
      ? this.detectLanguage(text) 
      : options.language;

    const instructions: string[] = [];
    
    if (options.removeFillerWords) {
      if (language === 'zh') {
        instructions.push('- 删除填充词："嗯", "啊", "那个", "就是", "然后", "所以", "对吧"');
      } else {
        instructions.push('- Remove filler words: "um", "uh", "like", "you know", "so", "well"');
      }
    }

    if (options.removeRepetition) {
      if (language === 'zh') {
        instructions.push('- 删除重复词语（例如："你好你好" → "你好"）');
      } else {
        instructions.push('- Remove repeated words (e.g., "hello hello" → "hello")');
      }
    }

    if (options.detectSelfCorrection) {
      if (language === 'zh') {
        instructions.push('- 检测自我修正：如果说话者改口（"不对，应该是...", "我是说..."），只保留最终版本');
      } else {
        instructions.push('- Detect self-corrections: if speaker corrects themselves ("I mean...", "actually..."), keep only the final version');
      }
    }

    const systemPrompt = language === 'zh' 
      ? `你是一位专业的文本编辑助手。请优化以下语音转录文本，使其更流畅、专业。\n\n优化规则：\n${instructions.join('\n')}\n\n要求：\n- 保持原意不变\n- 让文本更简洁流畅\n- 只返回优化后的文本，不要解释`
      : `You are a professional text editor. Please polish the following transcribed speech to make it more fluent and professional.\n\nOptimization rules:\n${instructions.join('\n')}\n\nRequirements:\n- Maintain the original meaning\n- Make text concise and flowing\n- Return only the polished text, no explanations`;

    return systemPrompt;
  }

  /**
   * Detect language (simple heuristic)
   */
  private detectLanguage(text: string): 'zh' | 'en' {
    // Check for Chinese characters
    const chineseCharPattern = /[\u4e00-\u9fa5]/;
    return chineseCharPattern.test(text) ? 'zh' : 'en';
  }

  /**
   * Call OpenAI API
   */
  private async callOpenAI(
    prompt: string,
    originalText: string,
    provider: ProviderConfig
  ): Promise<Omit<AiPostProcessingResult, 'latencyMs'>> {
    const response = await fetch(provider.baseUrl || 'https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${provider.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: provider.model || 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: prompt },
          { role: 'user', content: originalText },
        ],
        temperature: 0.3,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${error}`);
    }

    const data = await response.json() as {
      choices: Array<{ message: { content: string } }>;
      model: string;
    };

    const processedText = data.choices[0]?.message?.content?.trim() || originalText;
    
    return {
      success: true,
      originalText,
      processedText,
      changes: this.computeChanges(originalText, processedText),
      provider: 'OpenAI',
      model: data.model,
    };
  }

  /**
   * Call Groq API
   */
  private async callGroq(
    prompt: string,
    originalText: string,
    provider: ProviderConfig
  ): Promise<Omit<AiPostProcessingResult, 'latencyMs'>> {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${provider.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: provider.model || 'llama-3.1-70b-versatile',
        messages: [
          { role: 'system', content: prompt },
          { role: 'user', content: originalText },
        ],
        temperature: 0.3,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Groq API error: ${error}`);
    }

    const data = await response.json() as {
      choices: Array<{ message: { content: string } }>;
      model: string;
    };

    const processedText = data.choices[0]?.message?.content?.trim() || originalText;
    
    return {
      success: true,
      originalText,
      processedText,
      changes: this.computeChanges(originalText, processedText),
      provider: 'Groq',
      model: data.model,
    };
  }

  /**
   * Call Anthropic API
   */
  private async callAnthropic(
    prompt: string,
    originalText: string,
    provider: ProviderConfig
  ): Promise<Omit<AiPostProcessingResult, 'latencyMs'>> {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': provider.apiKey!,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: provider.model || 'claude-3-sonnet-20240229',
        max_tokens: 2000,
        system: prompt,
        messages: [
          { role: 'user', content: originalText },
        ],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Anthropic API error: ${error}`);
    }

    const data = await response.json() as {
      content: Array<{ text: string }>;
      model: string;
    };

    const processedText = data.content[0]?.text?.trim() || originalText;
    
    return {
      success: true,
      originalText,
      processedText,
      changes: this.computeChanges(originalText, processedText),
      provider: 'Anthropic',
      model: data.model,
    };
  }

  /**
   * Call DeepSeek API
   */
  private async callDeepSeek(
    prompt: string,
    originalText: string,
    provider: ProviderConfig
  ): Promise<Omit<AiPostProcessingResult, 'latencyMs'>> {
    const response = await fetch(provider.baseUrl || 'https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${provider.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: provider.model || 'deepseek-chat',
        messages: [
          { role: 'system', content: prompt },
          { role: 'user', content: originalText },
        ],
        temperature: 0.3,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`DeepSeek API error: ${error}`);
    }

    const data = await response.json() as {
      choices: Array<{ message: { content: string } }>;
      model: string;
    };

    const processedText = data.choices[0]?.message?.content?.trim() || originalText;

    return {
      success: true,
      originalText,
      processedText,
      changes: this.computeChanges(originalText, processedText),
      provider: 'DeepSeek',
      model: data.model,
    };
  }

  /**
   * Call Zhipu GLM API
   */
  private async callZhipu(
    prompt: string,
    originalText: string,
    provider: ProviderConfig
  ): Promise<Omit<AiPostProcessingResult, 'latencyMs'>> {
    const response = await fetch(provider.baseUrl || 'https://open.bigmodel.cn/api/paas/v4/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${provider.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: provider.model || 'glm-4',
        messages: [
          { role: 'system', content: prompt },
          { role: 'user', content: originalText },
        ],
        temperature: 0.3,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Zhipu API error: ${error}`);
    }

    const data = await response.json() as {
      choices: Array<{ message: { content: string } }>;
      model: string;
    };

    const processedText = data.choices[0]?.message?.content?.trim() || originalText;

    return {
      success: true,
      originalText,
      processedText,
      changes: this.computeChanges(originalText, processedText),
      provider: '智谱 GLM',
      model: data.model,
    };
  }

  /**
   * Call MiniMax API
   */
  private async callMiniMax(
    prompt: string,
    originalText: string,
    provider: ProviderConfig
  ): Promise<Omit<AiPostProcessingResult, 'latencyMs'>> {
    const response = await fetch(provider.baseUrl || 'https://api.minimax.chat/v1/text/chatcompletion_v2', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${provider.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: provider.model || 'abab6.5s-chat',
        messages: [
          { role: 'system', content: prompt },
          { role: 'user', content: originalText },
        ],
        temperature: 0.3,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`MiniMax API error: ${error}`);
    }

    const data = await response.json() as {
      choices: Array<{ message: { content: string } }>;
      model: string;
    };

    const processedText = data.choices[0]?.message?.content?.trim() || originalText;

    return {
      success: true,
      originalText,
      processedText,
      changes: this.computeChanges(originalText, processedText),
      provider: 'MiniMax',
      model: data.model,
    };
  }

  /**
   * Call Moonshot (Kimi) API
   */
  private async callMoonshot(
    prompt: string,
    originalText: string,
    provider: ProviderConfig
  ): Promise<Omit<AiPostProcessingResult, 'latencyMs'>> {
    const response = await fetch(provider.baseUrl || 'https://api.moonshot.cn/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${provider.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: provider.model || 'moonshot-v1-8k',
        messages: [
          { role: 'system', content: prompt },
          { role: 'user', content: originalText },
        ],
        temperature: 0.3,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Moonshot API error: ${error}`);
    }

    const data = await response.json() as {
      choices: Array<{ message: { content: string } }>;
      model: string;
    };

    const processedText = data.choices[0]?.message?.content?.trim() || originalText;

    return {
      success: true,
      originalText,
      processedText,
      changes: this.computeChanges(originalText, processedText),
      provider: 'Kimi',
      model: data.model,
    };
  }

  /**
   * Compute changes between original and processed text
   * Returns an array of changes made
   */
  private computeChanges(original: string, processed: string): TextChange[] {
    const changes: TextChange[] = [];
    
    // Simple heuristic: if text changed significantly, record as improvement
    if (original !== processed) {
      // Check for filler word removal
      const fillerWordsZh = ['嗯', '啊', '那个', '就是', '然后'];
      const fillerWordsEn = ['um', 'uh', 'like', 'you know', 'well'];
      
      for (const word of fillerWordsZh) {
        if (original.includes(word) && !processed.includes(word)) {
          changes.push({
            type: 'filler',
            original: word,
            replacement: '',
            position: original.indexOf(word),
            explanation: 'Removed filler word',
          });
        }
      }
      
      for (const word of fillerWordsEn) {
        const regex = new RegExp(`\\b${word}\\b`, 'gi');
        if (regex.test(original) && !regex.test(processed)) {
          changes.push({
            type: 'filler',
            original: word,
            replacement: '',
            position: original.search(regex),
            explanation: 'Removed filler word',
          });
        }
      }

      // If no specific changes detected but text is different, mark as improvement
      if (changes.length === 0) {
        changes.push({
          type: 'improvement',
          original: original.substring(0, 50) + (original.length > 50 ? '...' : ''),
          replacement: processed.substring(0, 50) + (processed.length > 50 ? '...' : ''),
          position: 0,
          explanation: 'Text polished for better flow',
        });
      }
    }

    return changes;
  }
}
