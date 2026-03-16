import { vi } from 'vitest';

type MockFn<T extends (...args: any[]) => any> = ReturnType<typeof vi.fn<T>>;

export interface MockTextChange {
  type: 'filler' | 'repetition' | 'correction' | 'improvement';
  original: string;
  replacement: string;
  position: number;
  explanation?: string;
}

export interface MockTranscriptionResult {
  rawText?: string;
  processedText?: string;
  text: string;
  success: boolean;
  provider: string;
  aiProcessed?: boolean;
  aiChanges?: MockTextChange[];
  aiLatency?: number;
  aiProvider?: string;
  error?: string;
  fallbackToClipboard?: boolean;
}

export interface MockAiPostProcessingSettings {
  enabled: boolean;
  providerId?: string;
  options: {
    removeFillerWords: boolean;
    removeRepetition: boolean;
    detectSelfCorrection: boolean;
    restorePunctuation: boolean;
  };
  showComparison: boolean;
}

export interface ElectronAPIMock {
  storeGet: MockFn<(key: string) => Promise<unknown>>;
  storeSet: MockFn<(key: string, value: unknown) => Promise<void>>;
  recordingStart: MockFn<() => Promise<void>>;
  recordingStop: MockFn<() => Promise<void>>;
  recordingGetState: MockFn<() => Promise<boolean>>;
  providersList: MockFn<() => Promise<unknown[]>>;
  providersListTranscription: MockFn<() => Promise<unknown[]>>;
  providersListPostProcessing: MockFn<() => Promise<unknown[]>>;
  providersGetConfig: MockFn<(id: string) => Promise<unknown>>;
  providersSetConfig: MockFn<(id: string, config: unknown) => Promise<void>>;
  providersTest: MockFn<(id: string) => Promise<{ success: boolean; error?: string }>>;
  aiGetSettings: MockFn<() => Promise<MockAiPostProcessingSettings>>;
  aiSetSettings: MockFn<(settings: Partial<MockAiPostProcessingSettings>) => Promise<void>>;
  aiTest: MockFn<(text: string) => Promise<{ success: boolean; processedText?: string; changes?: MockTextChange[]; provider?: string; latencyMs?: number; error?: string }>>;
  historyGet: MockFn<(limit: number) => Promise<unknown[]>>;
  historyDelete: MockFn<(id: string) => Promise<void>>;
  historyClear: MockFn<() => Promise<void>>;
  dictionaryGet: MockFn<() => Promise<unknown[]>>;
  dictionaryAdd: MockFn<(word: string, replacement: string) => Promise<void>>;
  dictionaryRemove: MockFn<(word: string) => Promise<void>>;
  windowHide: MockFn<() => Promise<void>>;
  windowShow: MockFn<() => Promise<void>>;
  textInsert: MockFn<(text: string) => Promise<{ success: boolean; method: 'paste' | 'clipboard' | 'type' | 'failed'; error?: string; text: string; accessibilityRequired?: boolean }>>;
  systemGetStatus: MockFn<() => Promise<{ audio: { ffmpegAvailable: boolean; hasAudioDevices: boolean; deviceCount: number }; transcription: { whisperInstalled: boolean; modelAvailable: boolean; hasCloudProvider: boolean; activeProvider?: string; recommendations: string[] } }>>;
  onRecordingStarted: MockFn<(callback: () => void) => () => void>;
  onRecordingStopped: MockFn<(callback: () => void) => () => void>;
  onTranscriptionComplete: MockFn<(callback: (result: MockTranscriptionResult) => void) => () => void>;
  onNavigate: MockFn<(callback: (path: string) => void) => () => void>;
  // Data export/cleanup
  getStorageStats: MockFn<() => Promise<{ historyCount: number; dictionaryCount: number; tempFilesCount: number; tempFilesSize: number }>>;
  clearTemporaryFiles: MockFn<(maxAgeHours?: number) => Promise<{ deleted: number; freedBytes: number }>>;
  clearAllData: MockFn<(resetSettings: boolean) => Promise<void>>;
  exportHistory: MockFn<(format: 'json' | 'csv') => Promise<{ success: boolean; data?: string; error?: string }>>;
  exportDictionary: MockFn<() => Promise<{ success: boolean; data?: string; error?: string }>>;
  exportSettings: MockFn<() => Promise<{ success: boolean; data?: string; error?: string }>>;
  saveExportFile: MockFn<(data: string, filename: string) => Promise<{ success: boolean; path?: string; canceled?: boolean; error?: string }>>;
  // Audio device management
  audioGetDevices: MockFn<() => Promise<Array<{ index: string; name: string }>>>;
  audioGetSelectedDevice: MockFn<() => Promise<{ index: string; name: string; selectedAt: number } | undefined>>;
  audioSetSelectedDevice: MockFn<(device: { index: string; name: string; selectedAt: number }) => Promise<void>>;
}

export interface ElectronAPIMockHelpers {
  electronAPI: ElectronAPIMock;
  assignToWindow: () => ElectronAPIMock;
  resetElectronAPIMock: () => void;
}

const defaultAiSettings = (): MockAiPostProcessingSettings => ({
  enabled: false,
  options: {
    removeFillerWords: false,
    removeRepetition: false,
    detectSelfCorrection: false,
    restorePunctuation: true,
  },
  showComparison: false,
});

/**
 * Creates a reusable `window.electronAPI` mock for renderer tests.
 *
 * @example
 * ```ts
 * import { beforeEach, expect, it } from 'vitest';
 * import { createElectronAPIMock } from './mocks';
 *
 * const { electronAPI, assignToWindow, resetElectronAPIMock } = createElectronAPIMock();
 * assignToWindow();
 *
 * beforeEach(() => {
 *   resetElectronAPIMock();
 * });
 *
 * it('stubs settings lookups', async () => {
 *   electronAPI.storeGet.mockResolvedValue('openai');
 *   await expect(window.electronAPI.storeGet('preferredProvider')).resolves.toBe('openai');
 * });
 * ```
 */
export const createElectronAPIMock = (): ElectronAPIMockHelpers => {
  const unsubscribe = (): void => {};

  const electronAPI: ElectronAPIMock = {
    storeGet: vi.fn<(key: string) => Promise<unknown>>().mockResolvedValue(undefined),
    storeSet: vi.fn<(key: string, value: unknown) => Promise<void>>().mockResolvedValue(),
    recordingStart: vi.fn<() => Promise<void>>().mockResolvedValue(),
    recordingStop: vi.fn<() => Promise<void>>().mockResolvedValue(),
    recordingGetState: vi.fn<() => Promise<boolean>>().mockResolvedValue(false),
    providersList: vi.fn<() => Promise<unknown[]>>().mockResolvedValue([]),
    providersListTranscription: vi.fn<() => Promise<unknown[]>>().mockResolvedValue([]),
    providersListPostProcessing: vi.fn<() => Promise<unknown[]>>().mockResolvedValue([]),
    providersGetConfig: vi.fn<(id: string) => Promise<unknown>>().mockResolvedValue(null),
    providersSetConfig: vi.fn<(id: string, config: unknown) => Promise<void>>().mockResolvedValue(),
    providersTest: vi.fn<(id: string) => Promise<{ success: boolean; error?: string }>>().mockResolvedValue({ success: true }),
    aiGetSettings: vi.fn<() => Promise<MockAiPostProcessingSettings>>().mockResolvedValue(defaultAiSettings()),
    aiSetSettings: vi.fn<(settings: Partial<MockAiPostProcessingSettings>) => Promise<void>>().mockResolvedValue(),
    aiTest: vi.fn<(text: string) => Promise<{ success: boolean; processedText?: string; changes?: MockTextChange[]; provider?: string; latencyMs?: number; error?: string }>>().mockResolvedValue({ success: true, processedText: '' }),
    historyGet: vi.fn<(limit: number) => Promise<unknown[]>>().mockResolvedValue([]),
    historyDelete: vi.fn<(id: string) => Promise<void>>().mockResolvedValue(),
    historyClear: vi.fn<() => Promise<void>>().mockResolvedValue(),
    dictionaryGet: vi.fn<() => Promise<unknown[]>>().mockResolvedValue([]),
    dictionaryAdd: vi.fn<(word: string, replacement: string) => Promise<void>>().mockResolvedValue(),
    dictionaryRemove: vi.fn<(word: string) => Promise<void>>().mockResolvedValue(),
    windowHide: vi.fn<() => Promise<void>>().mockResolvedValue(),
    windowShow: vi.fn<() => Promise<void>>().mockResolvedValue(),
    textInsert: vi.fn<(text: string) => Promise<{ success: boolean; method: 'paste' | 'clipboard' | 'type' | 'failed'; error?: string; text: string; accessibilityRequired?: boolean }>>().mockImplementation(async (text) => ({ success: true, method: 'paste', text })),
    systemGetStatus: vi.fn<() => Promise<{ audio: { ffmpegAvailable: boolean; hasAudioDevices: boolean; deviceCount: number }; transcription: { whisperInstalled: boolean; modelAvailable: boolean; hasCloudProvider: boolean; activeProvider?: string; recommendations: string[] } }>>().mockResolvedValue({
      audio: { ffmpegAvailable: true, hasAudioDevices: true, deviceCount: 1 },
      transcription: { whisperInstalled: true, modelAvailable: true, hasCloudProvider: false, recommendations: [] },
    }),
    onRecordingStarted: vi.fn<(callback: () => void) => () => void>().mockReturnValue(unsubscribe),
    onRecordingStopped: vi.fn<(callback: () => void) => () => void>().mockReturnValue(unsubscribe),
    onTranscriptionComplete: vi.fn<(callback: (result: MockTranscriptionResult) => void) => () => void>().mockReturnValue(unsubscribe),
    onNavigate: vi.fn<(callback: (path: string) => void) => () => void>().mockReturnValue(unsubscribe),
    // Data export/cleanup
    getStorageStats: vi.fn<() => Promise<{ historyCount: number; dictionaryCount: number; tempFilesCount: number; tempFilesSize: number }>>().mockResolvedValue({ historyCount: 0, dictionaryCount: 0, tempFilesCount: 0, tempFilesSize: 0 }),
    clearTemporaryFiles: vi.fn<(maxAgeHours?: number) => Promise<{ deleted: number; freedBytes: number }>>().mockResolvedValue({ deleted: 0, freedBytes: 0 }),
    clearAllData: vi.fn<(resetSettings: boolean) => Promise<void>>().mockResolvedValue(),
    exportHistory: vi.fn<(format: 'json' | 'csv') => Promise<{ success: boolean; data?: string; error?: string }>>().mockResolvedValue({ success: true, data: '[]' }),
    exportDictionary: vi.fn<() => Promise<{ success: boolean; data?: string; error?: string }>>().mockResolvedValue({ success: true, data: '[]' }),
    exportSettings: vi.fn<() => Promise<{ success: boolean; data?: string; error?: string }>>().mockResolvedValue({ success: true, data: '{}' }),
    saveExportFile: vi.fn<(data: string, filename: string) => Promise<{ success: boolean; path?: string; canceled?: boolean; error?: string }>>().mockResolvedValue({ success: true, path: '/mock/path' }),
    // Audio device management
    audioGetDevices: vi.fn<() => Promise<Array<{ index: string; name: string }>>>().mockResolvedValue([{ index: '0', name: 'Mock Microphone' }]),
    audioGetSelectedDevice: vi.fn<() => Promise<{ index: string; name: string; selectedAt: number } | undefined>>().mockResolvedValue({ index: '0', name: 'Mock Microphone', selectedAt: Date.now() }),
    audioSetSelectedDevice: vi.fn<(device: { index: string; name: string; selectedAt: number }) => Promise<void>>().mockResolvedValue(),
  };

  const assignToWindow = (): ElectronAPIMock => {
    const target = globalThis as typeof globalThis & { window?: { electronAPI?: ElectronAPIMock } };
    target.window ??= {};
    target.window.electronAPI = electronAPI;
    return electronAPI;
  };

  const resetElectronAPIMock = (): void => {
    electronAPI.storeGet.mockReset();
    electronAPI.storeGet.mockResolvedValue(undefined);
    electronAPI.storeSet.mockReset();
    electronAPI.storeSet.mockResolvedValue();
    electronAPI.recordingStart.mockReset();
    electronAPI.recordingStart.mockResolvedValue();
    electronAPI.recordingStop.mockReset();
    electronAPI.recordingStop.mockResolvedValue();
    electronAPI.recordingGetState.mockReset();
    electronAPI.recordingGetState.mockResolvedValue(false);
    electronAPI.providersList.mockReset();
    electronAPI.providersList.mockResolvedValue([]);
    electronAPI.providersListTranscription.mockReset();
    electronAPI.providersListTranscription.mockResolvedValue([]);
    electronAPI.providersListPostProcessing.mockReset();
    electronAPI.providersListPostProcessing.mockResolvedValue([]);
    electronAPI.providersGetConfig.mockReset();
    electronAPI.providersGetConfig.mockResolvedValue(null);
    electronAPI.providersSetConfig.mockReset();
    electronAPI.providersSetConfig.mockResolvedValue();
    electronAPI.providersTest.mockReset();
    electronAPI.providersTest.mockResolvedValue({ success: true });
    electronAPI.aiGetSettings.mockReset();
    electronAPI.aiGetSettings.mockResolvedValue(defaultAiSettings());
    electronAPI.aiSetSettings.mockReset();
    electronAPI.aiSetSettings.mockResolvedValue();
    electronAPI.aiTest.mockReset();
    electronAPI.aiTest.mockResolvedValue({ success: true, processedText: '' });
    electronAPI.historyGet.mockReset();
    electronAPI.historyGet.mockResolvedValue([]);
    electronAPI.historyDelete.mockReset();
    electronAPI.historyDelete.mockResolvedValue();
    electronAPI.historyClear.mockReset();
    electronAPI.historyClear.mockResolvedValue();
    electronAPI.dictionaryGet.mockReset();
    electronAPI.dictionaryGet.mockResolvedValue([]);
    electronAPI.dictionaryAdd.mockReset();
    electronAPI.dictionaryAdd.mockResolvedValue();
    electronAPI.dictionaryRemove.mockReset();
    electronAPI.dictionaryRemove.mockResolvedValue();
    electronAPI.windowHide.mockReset();
    electronAPI.windowHide.mockResolvedValue();
    electronAPI.windowShow.mockReset();
    electronAPI.windowShow.mockResolvedValue();
    electronAPI.textInsert.mockReset();
    electronAPI.textInsert.mockImplementation(async (text) => ({ success: true, method: 'paste', text }));
    electronAPI.systemGetStatus.mockReset();
    electronAPI.systemGetStatus.mockResolvedValue({
      audio: { ffmpegAvailable: true, hasAudioDevices: true, deviceCount: 1 },
      transcription: { whisperInstalled: true, modelAvailable: true, hasCloudProvider: false, recommendations: [] },
    });
    electronAPI.onRecordingStarted.mockReset();
    electronAPI.onRecordingStarted.mockReturnValue(unsubscribe);
    electronAPI.onRecordingStopped.mockReset();
    electronAPI.onRecordingStopped.mockReturnValue(unsubscribe);
    electronAPI.onTranscriptionComplete.mockReset();
    electronAPI.onTranscriptionComplete.mockReturnValue(unsubscribe);
    electronAPI.onNavigate.mockReset();
    electronAPI.onNavigate.mockReturnValue(unsubscribe);
    // Data export/cleanup
    electronAPI.getStorageStats.mockReset();
    electronAPI.getStorageStats.mockResolvedValue({ historyCount: 0, dictionaryCount: 0, tempFilesCount: 0, tempFilesSize: 0 });
    electronAPI.clearTemporaryFiles.mockReset();
    electronAPI.clearTemporaryFiles.mockResolvedValue({ deleted: 0, freedBytes: 0 });
    electronAPI.clearAllData.mockReset();
    electronAPI.clearAllData.mockResolvedValue();
    electronAPI.exportHistory.mockReset();
    electronAPI.exportHistory.mockResolvedValue({ success: true, data: '[]' });
    electronAPI.exportDictionary.mockReset();
    electronAPI.exportDictionary.mockResolvedValue({ success: true, data: '[]' });
    electronAPI.exportSettings.mockReset();
    electronAPI.exportSettings.mockResolvedValue({ success: true, data: '{}' });
    electronAPI.saveExportFile.mockReset();
    electronAPI.saveExportFile.mockResolvedValue({ success: true, path: '/mock/path' });
    // Audio device management
    electronAPI.audioGetDevices.mockReset();
    electronAPI.audioGetDevices.mockResolvedValue([{ index: '0', name: 'Mock Microphone' }]);
    electronAPI.audioGetSelectedDevice.mockReset();
    electronAPI.audioGetSelectedDevice.mockResolvedValue({ index: '0', name: 'Mock Microphone', selectedAt: Date.now() });
    electronAPI.audioSetSelectedDevice.mockReset();
    electronAPI.audioSetSelectedDevice.mockResolvedValue();
  };

  return {
    electronAPI,
    assignToWindow,
    resetElectronAPIMock,
  };
};
