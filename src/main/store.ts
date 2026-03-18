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
  category?: string;   // 'general' | 'technical' | 'names' | 'custom'
  createdAt?: number;
}

export interface DictionaryCategory {
  id: string;
  name: string;
  color: string;
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
  dictionaryCategories?: DictionaryCategory[];
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

  addDictionaryEntry(word: string, replacement: string, category?: string): void {
    const dictionary = this.getDictionary();
    const existingIndex = dictionary.findIndex(e => e.word === word);
    if (existingIndex >= 0) {
      dictionary[existingIndex].replacement = replacement;
      if (category !== undefined) dictionary[existingIndex].category = category;
    } else {
      dictionary.push({ word, replacement, category, createdAt: Date.now() });
    }
    this.setAny('dictionary', dictionary);
  }

  removeDictionaryEntry(word: string): void {
    const dictionary = this.getDictionary();
    this.setAny('dictionary', dictionary.filter(e => e.word !== word));
  }

  // ==================== Dictionary Categories ====================

  getDictionaryCategories(): DictionaryCategory[] {
    const defaults: DictionaryCategory[] = [
      { id: 'general', name: 'General', color: '#6366f1' },
      { id: 'technical', name: 'Technical', color: '#10b981' },
      { id: 'names', name: 'Names', color: '#f59e0b' },
      { id: 'custom', name: 'Custom', color: '#8b5cf6' },
    ];
    return this.getAny<DictionaryCategory[]>('dictionaryCategories') || defaults;
  }

  addDictionaryCategory(name: string, color: string): void {
    const categories = this.getDictionaryCategories();
    const id = name.toLowerCase().replace(/\s+/g, '-');
    if (!categories.find(c => c.id === id)) {
      categories.push({ id, name, color });
      this.setAny('dictionaryCategories', categories);
    }
  }

  removeDictionaryCategory(id: string): void {
    const categories = this.getDictionaryCategories();
    const filtered = categories.filter(c => c.id !== id);
    this.setAny('dictionaryCategories', filtered);
    // Move entries in this category to uncategorized
    const dictionary = this.getDictionary();
    const updated = dictionary.map(e =>
      e.category === id ? { ...e, category: undefined } : e
    );
    this.setAny('dictionary', updated);
  }

  // ==================== Dictionary Import/Export ====================

  /**
   * Import dictionary entries from JSON string.
   */
  importDictionaryFromJSON(json: string): { imported: number; skipped: number; errors: string[] } {
    const errors: string[] = [];
    let imported = 0;
    let skipped = 0;
    const existing = this.getDictionary();
    const existingWords = new Set(existing.map(e => e.word.toLowerCase()));

    try {
      const data = JSON.parse(json);
      const entries = Array.isArray(data) ? data : data.entries || [];

      for (const entry of entries) {
        if (!entry.word || !entry.replacement) {
          errors.push(`Skipped entry: missing word or replacement`);
          skipped++;
          continue;
        }
        if (existingWords.has(entry.word.toLowerCase())) {
          skipped++;
          continue;
        }
        const newEntry: DictionaryEntry = {
          word: String(entry.word),
          replacement: String(entry.replacement),
          category: entry.category,
          createdAt: Date.now(),
        };
        existing.push(newEntry);
        existingWords.add(entry.word.toLowerCase());
        imported++;
      }

      this.setAny('dictionary', existing);
    } catch (e: any) {
      errors.push(`JSON parse error: ${e?.message}`);
    }

    return { imported, skipped, errors };
  }

  /**
   * Import dictionary entries from CSV string.
   * Format: word,replacement[,category]
   */
  importDictionaryFromCSV(csv: string): { imported: number; skipped: number; errors: string[] } {
    const errors: string[] = [];
    let imported = 0;
    let skipped = 0;
    const existing = this.getDictionary();
    const existingWords = new Set(existing.map(e => e.word.toLowerCase()));
    const lines = csv.split('\n').filter(l => l.trim());

    // Skip header row if it looks like a header
    const dataLines = lines[0]?.toLowerCase().includes('word') ? lines.slice(1) : lines;

    for (const line of dataLines) {
      const parts = line.split(',').map(p => p.trim().replace(/^"|"$/g, ''));
      if (parts.length < 2 || !parts[0] || !parts[1]) {
        errors.push(`Skipped line: ${line.substring(0, 50)}`);
        skipped++;
        continue;
      }
      if (existingWords.has(parts[0].toLowerCase())) {
        skipped++;
        continue;
      }
      const newEntry: DictionaryEntry = {
        word: parts[0],
        replacement: parts[1],
        category: parts[2] || undefined,
        createdAt: Date.now(),
      };
      existing.push(newEntry);
      existingWords.add(parts[0].toLowerCase());
      imported++;
    }

    this.setAny('dictionary', existing);
    return { imported, skipped, errors };
  }

  /**
   * Export dictionary to CSV format.
   */
  exportDictionaryToCSV(): string {
    const dictionary = this.getDictionary();
    if (dictionary.length === 0) {
      return 'word,replacement,category\n';
    }
    const rows = dictionary.map(e => {
      const word = `"${e.word.replace(/"/g, '""')}"`;
      const replacement = `"${e.replacement.replace(/"/g, '""')}"`;
      const category = e.category || '';
      return `${word},${replacement},${category}`;
    });
    return ['word,replacement,category', ...rows].join('\n');
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
    return this.getDictionary().map(e => ({
      word: e.word,
      replacement: e.replacement,
      ...(e.category ? { category: e.category } : {}),
      ...(e.createdAt ? { createdAt: e.createdAt } : {}),
    }));
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

