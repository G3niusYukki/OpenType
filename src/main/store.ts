import StoreModule from 'electron-store';
import fs from 'fs';

export interface HistoryItem {
  id: string;
  timestamp: number;
  audioPath: string;
  text: string;
  rawText?: string;
  processedText?: string;
  aiChanges?: Array<{
    type: 'filler' | 'repetition' | 'correction' | 'improvement';
    original: string;
    replacement: string;
    position: number;
    explanation?: string;
  }>;
  status: 'pending' | 'completed' | 'error';
  provider?: string;
  aiProvider?: string;
}

export interface DictionaryEntry {
  word: string;
  replacement: string;
}

export interface ProviderConfig {
  id: string;
  name: string;
  enabled: boolean;
  enabledForTranscription?: boolean;
  enabledForPostProcessing?: boolean;
  apiKey?: string; // Deprecated: migrated to secure storage
  hasKeyInKeychain?: boolean;
  baseUrl?: string;
  model?: string;
  region?: string; // For region-specific providers (e.g., Alibaba Cloud)
  options?: Record<string, unknown>; // Provider-specific options
}

export interface AiPostProcessingOptions {
  removeFillerWords: boolean;
  removeRepetition: boolean;
  detectSelfCorrection: boolean;
  restorePunctuation?: boolean;
}

export interface AiPostProcessingSettings {
  enabled: boolean;
  providerId?: string;
  options: AiPostProcessingOptions;
  showComparison: boolean;
}

export interface VoiceInputModeSettings {
  basicVoiceInput: boolean;
  handsFreeMode: boolean;
  translateToEnglish: boolean;
  editSelectedText: boolean;
}

export interface AudioInputDevice {
  index: string;
  name: string;
  selectedAt: number;
}

export interface FallbackSettings {
  enabled: boolean;
  providerOrder: string[]; // Provider IDs in fallback priority order
  maxAttempts: number;
  skipUnhealthyProviders: boolean;
}

export interface AppSettings {
  hotkey: string;
  handsFreeHotkey: string;
  translateHotkey: string;
  editTextHotkey: string;
  outputMode: 'paste' | 'copy' | 'type';
  language: string;
  autoPunctuation: boolean;
  punctuationLanguage: 'chinese' | 'english' | 'auto';
  providers: ProviderConfig[];
  preferredProvider: 'local' | 'cloud' | 'auto';
  fallbackSettings: FallbackSettings;
  aiPostProcessing: AiPostProcessingSettings;
  voiceInputModes: VoiceInputModeSettings;
  audioInputDevice?: AudioInputDevice;
}

type ExtraStoreData = {
  history?: HistoryItem[];
  dictionary?: DictionaryEntry[];
};

const DEFAULT_SETTINGS: AppSettings = {
  hotkey: 'CommandOrControl+Shift+D',
  handsFreeHotkey: 'CommandOrControl+Space',
  translateHotkey: 'CommandOrControl+Shift+T',
  editTextHotkey: 'CommandOrControl+Shift+E',
  outputMode: 'paste',
  language: 'en-US',
  autoPunctuation: true,
  punctuationLanguage: 'auto',
  preferredProvider: 'auto',
  providers: [
    { id: 'openai', name: 'OpenAI', enabled: false },
    { id: 'anthropic', name: 'Anthropic', enabled: false },
    { id: 'groq', name: 'Groq', enabled: false },
    { id: 'aliyun-asr', name: '阿里云语音识别', enabled: false },
    { id: 'local', name: 'Local Model', enabled: false, baseUrl: 'http://localhost:11434' },
  ],
  fallbackSettings: {
    enabled: true,
    providerOrder: ['aliyun-asr', 'groq', 'openai', 'local'],
    maxAttempts: 3,
    skipUnhealthyProviders: true,
  },
  aiPostProcessing: {
    enabled: false,
    options: {
      removeFillerWords: true,
      removeRepetition: true,
      detectSelfCorrection: true,
      restorePunctuation: true,
    },
    showComparison: true,
  },
  voiceInputModes: {
    basicVoiceInput: true,
    handsFreeMode: true,
    translateToEnglish: true,
    editSelectedText: true,
  },
};

export class Store {
  private store: any;

  constructor() {
    this.store = new StoreModule({
      name: 'opentype-config',
      defaults: {
        ...DEFAULT_SETTINGS,
        history: [],
        dictionary: [],
      },
    });
  }

  get<K extends keyof AppSettings>(key: K): AppSettings[K] {
    return this.store.get(key) as AppSettings[K];
  }

  set<K extends keyof AppSettings>(key: K, value: AppSettings[K]): void {
    this.store.set(key, value);
  }

  getAny<T = unknown>(key: string): T | undefined {
    return this.store.get(key) as T | undefined;
  }

  setAny(key: string, value: unknown): void {
    this.store.set(key, value);
  }

  getHistory(limit = 100): HistoryItem[] {
    const history = this.getAny<ExtraStoreData['history']>('history') || [];
    return history.slice(-limit).reverse();
  }

  addHistoryItem(item: HistoryItem): void {
    const history = this.getAny<ExtraStoreData['history']>('history') || [];
    history.push(item);
    if (history.length > 500) {
      history.shift();
    }
    this.setAny('history', history);
  }

  deleteHistoryItem(id: string): void {
    const history = this.getAny<ExtraStoreData['history']>('history') || [];
    this.setAny('history', history.filter(item => item.id !== id));
  }

  clearHistory(): void {
    this.setAny('history', []);
  }

  getDictionary(): DictionaryEntry[] {
    return this.getAny<ExtraStoreData['dictionary']>('dictionary') || [];
  }

  addDictionaryEntry(word: string, replacement: string): void {
    const dictionary = this.getDictionary();
    const existingIndex = dictionary.findIndex(e => e.word === word);
    if (existingIndex >= 0) {
      dictionary[existingIndex].replacement = replacement;
    } else {
      dictionary.push({ word, replacement });
    }
    this.setAny('dictionary', dictionary);
  }

  removeDictionaryEntry(word: string): void {
    const dictionary = this.getDictionary();
    this.setAny('dictionary', dictionary.filter(e => e.word !== word));
  }

  applyDictionary(text: string): string {
    const dictionary = this.getDictionary();
    let result = text;
    for (const entry of dictionary) {
      const regex = new RegExp(`\\b${entry.word}\\b`, 'gi');
      result = result.replace(regex, entry.replacement);
    }
    return result;
  }

  getAudioInputDevice(): AudioInputDevice | undefined {
    return this.get('audioInputDevice');
  }

  setAudioInputDevice(device: AudioInputDevice): void {
    this.set('audioInputDevice', device);
  }

  // ==================== Data Export Methods ====================

  /**
   * Export history to JSON format
   */
  exportHistoryToJSON(): HistoryItem[] {
    return this.getAny<HistoryItem[]>('history') || [];
  }

  /**
   * Export history to CSV format
   */
  exportHistoryToCSV(): string {
    const history = this.getHistory();
    if (history.length === 0) {
      return 'timestamp,text,provider,status\n';
    }

    const rows = history.map(item => {
      const timestamp = new Date(item.timestamp).toISOString();
      const text = `"${(item.text || '').replace(/"/g, '""')}"`;
      const provider = item.provider || '';
      const status = item.status;
      return `${timestamp},${text},${provider},${status}`;
    });

    return ['timestamp,text,provider,status', ...rows].join('\n');
  }

  /**
   * Export dictionary to JSON format
   */
  exportDictionaryToJSON(): DictionaryEntry[] {
    return this.getDictionary();
  }

  /**
   * Export settings to JSON format (sanitized - no API keys)
   */
  exportSettingsToJSON(): Omit<AppSettings, 'providers'> & { providers: Omit<ProviderConfig, 'apiKey'>[] } {
    const settings = {
      hotkey: this.get('hotkey'),
      handsFreeHotkey: this.get('handsFreeHotkey'),
      translateHotkey: this.get('translateHotkey'),
      editTextHotkey: this.get('editTextHotkey'),
      outputMode: this.get('outputMode'),
      language: this.get('language'),
      autoPunctuation: this.get('autoPunctuation'),
      punctuationLanguage: this.get('punctuationLanguage'),
      preferredProvider: this.get('preferredProvider'),
      fallbackSettings: this.get('fallbackSettings'),
      aiPostProcessing: this.get('aiPostProcessing'),
      voiceInputModes: this.get('voiceInputModes'),
      audioInputDevice: this.get('audioInputDevice'),
      providers: this.get('providers').map(p => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { apiKey: _, ...sanitizedProvider } = p;
        return sanitizedProvider;
      }),
    };
    return settings;
  }

  // ==================== Data Cleanup Methods ====================

  /**
   * Get storage usage statistics
   */
  async getStorageStats(): Promise<{
    historyCount: number;
    dictionaryCount: number;
    tempFilesCount: number;
    tempFilesSize: number; // in bytes
  }> {
    const history = this.getAny<HistoryItem[]>('history') || [];
    const dictionary = this.getDictionary();

    // Calculate temp files (audio files referenced in history that still exist)
    let tempFilesCount = 0;
    let tempFilesSize = 0;

    for (const item of history) {
      if (item.audioPath && fs.existsSync(item.audioPath)) {
        try {
          const stats = fs.statSync(item.audioPath);
          tempFilesCount++;
          tempFilesSize += stats.size;
        } catch {
          // File doesn't exist or can't be accessed
        }
      }
    }

    return {
      historyCount: history.length,
      dictionaryCount: dictionary.length,
      tempFilesCount,
      tempFilesSize,
    };
  }

  /**
   * Clear temporary files older than specified age (in hours)
   */
  async clearTemporaryFiles(maxAgeHours: number = 24): Promise<{ deleted: number; freedBytes: number }> {
    const history = this.getAny<HistoryItem[]>('history') || [];
    const now = Date.now();
    const maxAgeMs = maxAgeHours * 60 * 60 * 1000;

    let deleted = 0;
    let freedBytes = 0;

    for (const item of history) {
      if (item.audioPath && fs.existsSync(item.audioPath)) {
        try {
          const stats = fs.statSync(item.audioPath);
          const fileAge = now - stats.mtimeMs;

          if (fileAge > maxAgeMs) {
            freedBytes += stats.size;
            fs.unlinkSync(item.audioPath);
            deleted++;
          }
        } catch {
          // Ignore errors for individual files
        }
      }
    }

    return { deleted, freedBytes };
  }

  /**
   * Clear all data including history, dictionary, and reset settings
   */
  async clearAllData(resetSettings: boolean = false): Promise<void> {
    // Clear history and associated audio files
    const history = this.getAny<HistoryItem[]>('history') || [];
    for (const item of history) {
      if (item.audioPath && fs.existsSync(item.audioPath)) {
        try {
          fs.unlinkSync(item.audioPath);
        } catch {
          // Ignore errors for individual files
        }
      }
    }

    this.setAny('history', []);
    this.setAny('dictionary', []);

    if (resetSettings) {
      // Reset settings to defaults (preserve credentials in secure storage)
      this.set('hotkey', DEFAULT_SETTINGS.hotkey);
      this.set('handsFreeHotkey', DEFAULT_SETTINGS.handsFreeHotkey);
      this.set('translateHotkey', DEFAULT_SETTINGS.translateHotkey);
      this.set('editTextHotkey', DEFAULT_SETTINGS.editTextHotkey);
      this.set('outputMode', DEFAULT_SETTINGS.outputMode);
      this.set('language', DEFAULT_SETTINGS.language);
      this.set('autoPunctuation', DEFAULT_SETTINGS.autoPunctuation);
      this.set('punctuationLanguage', DEFAULT_SETTINGS.punctuationLanguage);
      this.set('preferredProvider', DEFAULT_SETTINGS.preferredProvider);
      this.set('fallbackSettings', DEFAULT_SETTINGS.fallbackSettings);
      this.set('aiPostProcessing', DEFAULT_SETTINGS.aiPostProcessing);
      this.set('voiceInputModes', DEFAULT_SETTINGS.voiceInputModes);
      this.set('audioInputDevice', undefined);
      // Preserve providers but disable them
      const providers = this.get('providers').map(p => ({ ...p, enabled: false }));
      this.set('providers', providers);
    }
  }
}

