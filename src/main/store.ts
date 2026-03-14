import StoreModule from 'electron-store';

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
  apiKey?: string;
  baseUrl?: string;
  model?: string;
}

export interface AiPostProcessingOptions {
  removeFillerWords: boolean;
  removeRepetition: boolean;
  detectSelfCorrection: boolean;
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

export interface AppSettings {
  hotkey: string;
  handsFreeHotkey: string;
  translateHotkey: string;
  editTextHotkey: string;
  outputMode: 'paste' | 'copy' | 'type';
  language: string;
  autoPunctuation: boolean;
  providers: ProviderConfig[];
  preferredProvider: 'local' | 'cloud' | 'auto';
  aiPostProcessing: AiPostProcessingSettings;
  voiceInputModes: VoiceInputModeSettings;
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
  preferredProvider: 'auto',
  providers: [
    { id: 'openai', name: 'OpenAI', enabled: false },
    { id: 'anthropic', name: 'Anthropic', enabled: false },
    { id: 'groq', name: 'Groq', enabled: false },
    { id: 'local', name: 'Local Model', enabled: false, baseUrl: 'http://localhost:11434' },
  ],
  aiPostProcessing: {
    enabled: false,
    options: {
      removeFillerWords: true,
      removeRepetition: true,
      detectSelfCorrection: true,
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
}
