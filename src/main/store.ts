import StoreModule from 'electron-store';

interface HistoryItem {
  id: string;
  timestamp: number;
  audioPath: string;
  text: string;
  status: 'pending' | 'completed' | 'error';
}

interface DictionaryEntry {
  word: string;
  replacement: string;
}

interface ProviderConfig {
  id: string;
  name: string;
  enabled: boolean;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
}

interface AppSettings {
  hotkey: string;
  outputMode: 'paste' | 'copy' | 'type';
  language: string;
  autoPunctuation: boolean;
  providers: ProviderConfig[];
}

const DEFAULT_SETTINGS: AppSettings = {
  hotkey: 'CommandOrControl+Shift+D',
  outputMode: 'paste',
  language: 'en-US',
  autoPunctuation: true,
  providers: [
    { id: 'openai', name: 'OpenAI', enabled: false },
    { id: 'anthropic', name: 'Anthropic', enabled: false },
    { id: 'groq', name: 'Groq', enabled: false },
    { id: 'local', name: 'Local Model', enabled: false, baseUrl: 'http://localhost:11434' },
  ],
};

export class Store {
  private store: StoreModule;

  constructor() {
    this.store = new StoreModule({
      name: 'opentype-config',
      defaults: DEFAULT_SETTINGS,
    });
  }

  // Generic getters/setters
  get<K extends keyof AppSettings>(key: K): AppSettings[K] {
    return this.store.get(key) as AppSettings[K];
  }

  set<K extends keyof AppSettings>(key: K, value: AppSettings[K]): void {
    this.store.set(key, value);
  }

  // History management
  getHistory(limit = 100): HistoryItem[] {
    const history = (this.store.get('history') as HistoryItem[]) || [];
    return history.slice(-limit).reverse();
  }

  addHistoryItem(item: HistoryItem): void {
    const history = (this.store.get('history') as HistoryItem[]) || [];
    history.push(item);
    // Keep last 500 items
    if (history.length > 500) {
      history.shift();
    }
    this.store.set('history', history);
  }

  deleteHistoryItem(id: string): void {
    const history = (this.store.get('history') as HistoryItem[]) || [];
    this.store.set('history', history.filter(item => item.id !== id));
  }

  clearHistory(): void {
    this.store.set('history', []);
  }

  // Dictionary management
  getDictionary(): DictionaryEntry[] {
    return (this.store.get('dictionary') as DictionaryEntry[]) || [];
  }

  addDictionaryEntry(word: string, replacement: string): void {
    const dictionary = this.getDictionary();
    const existingIndex = dictionary.findIndex(e => e.word === word);
    if (existingIndex >= 0) {
      dictionary[existingIndex].replacement = replacement;
    } else {
      dictionary.push({ word, replacement });
    }
    this.store.set('dictionary', dictionary);
  }

  removeDictionaryEntry(word: string): void {
    const dictionary = this.getDictionary();
    this.store.set('dictionary', dictionary.filter(e => e.word !== word));
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
