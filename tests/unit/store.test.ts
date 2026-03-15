import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mockStoreGet as mockGet, mockStoreSet as mockSet, resetStoreMocks } from './mocks';
import { Store, HistoryItem, DictionaryEntry } from '../../src/main/store';

describe('Store', () => {
  let store: Store;

  beforeEach(() => {
    vi.clearAllMocks();
    resetStoreMocks();
    store = new Store();
  });

  describe('applyDictionary', () => {
    it('should replace words matching dictionary entries', () => {
      const dictionary: DictionaryEntry[] = [
        { word: 'ASR', replacement: 'Automatic Speech Recognition' },
        { word: 'API', replacement: 'Application Programming Interface' },
      ];
      mockGet.mockImplementation((key: string) => {
        if (key === 'dictionary') return dictionary;
        return undefined;
      });

      const result = store.applyDictionary('Use ASR and API');
      expect(result).toBe('Use Automatic Speech Recognition and Application Programming Interface');
    });

    it('should handle case-insensitive replacement', () => {
      const dictionary: DictionaryEntry[] = [
        { word: 'ASR', replacement: 'Automatic Speech Recognition' },
      ];
      mockGet.mockImplementation((key: string) => {
        if (key === 'dictionary') return dictionary;
        return undefined;
      });

      const result = store.applyDictionary('Use asr, ASR, and Asr');
      expect(result).toBe('Use Automatic Speech Recognition, Automatic Speech Recognition, and Automatic Speech Recognition');
    });

    it('should respect word boundaries', () => {
      const dictionary: DictionaryEntry[] = [
        { word: 'ASR', replacement: 'Automatic Speech Recognition' },
      ];
      mockGet.mockImplementation((key: string) => {
        if (key === 'dictionary') return dictionary;
        return undefined;
      });

      const result = store.applyDictionary('Use ASR, but not ASRock or MyASR');
      expect(result).toBe('Use Automatic Speech Recognition, but not ASRock or MyASR');
    });

    it('should return original text when dictionary is empty', () => {
      mockGet.mockImplementation((key: string) => {
        if (key === 'dictionary') return [];
        return undefined;
      });

      const text = 'No replacements needed';
      const result = store.applyDictionary(text);
      expect(result).toBe(text);
    });

    it('should handle multiple occurrences of same word', () => {
      const dictionary: DictionaryEntry[] = [
        { word: 'AI', replacement: 'Artificial Intelligence' },
      ];
      mockGet.mockImplementation((key: string) => {
        if (key === 'dictionary') return dictionary;
        return undefined;
      });

      const result = store.applyDictionary('AI is great. AI is the future.');
      expect(result).toBe('Artificial Intelligence is great. Artificial Intelligence is the future.');
    });
  });

  describe('History operations', () => {
    it('should add history item', () => {
      mockGet.mockReturnValue([]);

      const item: HistoryItem = {
        id: '1',
        timestamp: Date.now(),
        audioPath: '/tmp/test.wav',
        text: 'Test transcription',
        status: 'completed',
      };

      store.addHistoryItem(item);
      expect(mockSet).toHaveBeenCalledWith('history', [item]);
    });

    it('should maintain history limit of 500 items', () => {
      const existingHistory: HistoryItem[] = Array.from({ length: 500 }, (_, i) => ({
        id: String(i),
        timestamp: Date.now(),
        audioPath: `/tmp/test${i}.wav`,
        text: `Test ${i}`,
        status: 'completed',
      }));

      mockGet.mockReturnValue(existingHistory);

      const newItem: HistoryItem = {
        id: '501',
        timestamp: Date.now(),
        audioPath: '/tmp/new.wav',
        text: 'New item',
        status: 'completed',
      };

      store.addHistoryItem(newItem);

      const savedHistory = mockSet.mock.calls[0][1];
      expect(savedHistory).toHaveLength(500);
      expect(savedHistory[0].id).toBe('1');
      expect(savedHistory[499].id).toBe('501');
    });

    it('should return history in reverse chronological order with limit', () => {
      const history: HistoryItem[] = [
        { id: '1', timestamp: 1000, audioPath: '/tmp/1.wav', text: 'First', status: 'completed' },
        { id: '2', timestamp: 2000, audioPath: '/tmp/2.wav', text: 'Second', status: 'completed' },
        { id: '3', timestamp: 3000, audioPath: '/tmp/3.wav', text: 'Third', status: 'completed' },
      ];

      mockGet.mockReturnValue(history);

      const result = store.getHistory(2);
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('3');
      expect(result[1].id).toBe('2');
    });

    it('should delete history item by id', () => {
      const history: HistoryItem[] = [
        { id: '1', timestamp: 1000, audioPath: '/tmp/1.wav', text: 'First', status: 'completed' },
        { id: '2', timestamp: 2000, audioPath: '/tmp/2.wav', text: 'Second', status: 'completed' },
      ];

      mockGet.mockReturnValue(history);

      store.deleteHistoryItem('1');

      const savedHistory = mockSet.mock.calls[0][1];
      expect(savedHistory).toHaveLength(1);
      expect(savedHistory[0].id).toBe('2');
    });

    it('should clear all history', () => {
      store.clearHistory();
      expect(mockSet).toHaveBeenCalledWith('history', []);
    });
  });

  describe('Dictionary operations', () => {
    it('should add new dictionary entry', () => {
      mockGet.mockReturnValue([]);

      store.addDictionaryEntry('ASR', 'Automatic Speech Recognition');

      const savedDictionary = mockSet.mock.calls[0][1];
      expect(savedDictionary).toHaveLength(1);
      expect(savedDictionary[0]).toEqual({
        word: 'ASR',
        replacement: 'Automatic Speech Recognition',
      });
    });

    it('should update existing dictionary entry', () => {
      const existing: DictionaryEntry[] = [
        { word: 'ASR', replacement: 'Old Definition' },
      ];

      mockGet.mockReturnValue(existing);

      store.addDictionaryEntry('ASR', 'Automatic Speech Recognition');

      const savedDictionary = mockSet.mock.calls[0][1];
      expect(savedDictionary).toHaveLength(1);
      expect(savedDictionary[0].replacement).toBe('Automatic Speech Recognition');
    });

    it('should remove dictionary entry', () => {
      const existing: DictionaryEntry[] = [
        { word: 'ASR', replacement: 'Automatic Speech Recognition' },
        { word: 'API', replacement: 'Application Programming Interface' },
      ];

      mockGet.mockReturnValue(existing);

      store.removeDictionaryEntry('ASR');

      const savedDictionary = mockSet.mock.calls[0][1];
      expect(savedDictionary).toHaveLength(1);
      expect(savedDictionary[0].word).toBe('API');
    });
  });

  describe('Provider configuration', () => {
    it('should get default provider settings', () => {
      const providers = [
        { id: 'openai', name: 'OpenAI', enabled: false },
        { id: 'anthropic', name: 'Anthropic', enabled: false },
      ];

      mockGet.mockImplementation((key: string) => {
        if (key === 'providers') return providers;
        return undefined;
      });

      const result = store.get('providers');
      expect(result).toEqual(providers);
    });

    it('should set provider configuration', () => {
      const providers = [
        { id: 'openai', name: 'OpenAI', enabled: true, apiKey: 'sk-test' },
      ];

      store.set('providers', providers);
      expect(mockSet).toHaveBeenCalledWith('providers', providers);
    });

    it('should handle voice input mode settings', () => {
      const modes = {
        basicVoiceInput: true,
        handsFreeMode: false,
        translateToEnglish: true,
        editSelectedText: false,
      };

      mockGet.mockImplementation((key: string) => {
        if (key === 'voiceInputModes') return modes;
        return undefined;
      });

      const result = store.get('voiceInputModes');
      expect(result).toEqual(modes);
    });
  });
});
