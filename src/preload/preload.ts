import { contextBridge, ipcRenderer } from 'electron';

/**
 * OpenType Preload Script
 * 
 * Exposes safe IPC channels to the renderer process
 * All API calls go through here for security isolation
 */

export interface TextChange {
  type: 'filler' | 'repetition' | 'correction' | 'improvement';
  original: string;
  replacement: string;
  position: number;
  explanation?: string;
}

export interface TranscriptionResult {
  rawText?: string;
  processedText?: string;
  text: string;
  success: boolean;
  provider: string;
  aiProcessed?: boolean;
  aiChanges?: TextChange[];
  aiLatency?: number;
  aiProvider?: string;
  error?: string;
  fallbackToClipboard?: boolean;
}

export interface AiPostProcessingSettings {
  enabled: boolean;
  providerId?: string;
  options: {
    removeFillerWords: boolean;
    removeRepetition: boolean;
    detectSelfCorrection: boolean;
  };
  showComparison: boolean;
}

export interface ElectronAPI {
  // Store
  storeGet: (key: string) => Promise<unknown>;
  storeSet: (key: string, value: unknown) => Promise<void>;

  // Recording
  recordingStart: () => Promise<void>;
  recordingStop: () => Promise<void>;
  recordingGetState: () => Promise<boolean>;

  // Audio Device Management
  audioGetDevices: () => Promise<Array<{ index: string; name: string }>>;
  audioGetSelectedDevice: () => Promise<{ index: string; name: string; selectedAt: number } | undefined>;
  audioSetSelectedDevice: (device: { index: string; name: string; selectedAt: number }) => Promise<void>;

  // Diagnostics
  diagnosticsRun: () => Promise<{
    microphone: { status: string; message: string };
    accessibility: { status: string; message: string };
    automation: { status: string; message: string };
    ffmpeg: { status: string; version?: string; message: string };
    whisper: { status: string; path?: string; message: string };
    model: { status: string; path?: string; size?: number; message: string };
    transcriptionProvider: { status: string; provider: string; message: string };
  }>;
  diagnosticsGetLastFailure: () => Promise<{ timestamp: number; error: string; context: string } | null>;
  diagnosticsRequestPermission: (permissionType: 'microphone' | 'accessibility' | 'automation') => Promise<boolean>;
  diagnosticsOpenSettings: (permissionType: 'microphone' | 'accessibility' | 'automation') => Promise<void>;

  // Providers
  providersList: () => Promise<unknown[]>;
  providersListTranscription: () => Promise<unknown[]>;
  providersListPostProcessing: () => Promise<unknown[]>;
  providersGetConfig: (id: string) => Promise<unknown>;
  providersSetConfig: (id: string, config: unknown) => Promise<void>;
  providersTest: (id: string) => Promise<{ success: boolean; error?: string }>;

  aiGetSettings: () => Promise<AiPostProcessingSettings>;
  aiSetSettings: (settings: Partial<AiPostProcessingSettings>) => Promise<void>;
  aiTest: (text: string) => Promise<{
    success: boolean;
    processedText?: string;
    changes?: TextChange[];
    provider?: string;
    latencyMs?: number;
    error?: string;
  }>;

  // History
  historyGet: (limit: number) => Promise<unknown[]>;
  historyDelete: (id: string) => Promise<void>;
  historyClear: () => Promise<void>;

  // Data Export
  exportHistory: (format: 'json' | 'csv') => Promise<{ success: boolean; data?: string; error?: string }>;
  exportDictionary: () => Promise<{ success: boolean; data?: string; error?: string }>;
  exportSettings: () => Promise<{ success: boolean; data?: string; error?: string }>;
  saveExportFile: (data: string, filename: string) => Promise<{ success: boolean; path?: string; canceled?: boolean; error?: string }>;

  // Data Cleanup
  getStorageStats: () => Promise<{
    historyCount: number;
    dictionaryCount: number;
    tempFilesCount: number;
    tempFilesSize: number;
  }>;
  clearTemporaryFiles: (maxAgeHours?: number) => Promise<{ deleted: number; freedBytes: number }>;
  clearAllData: (resetSettings: boolean) => Promise<void>;

  // Dictionary
  dictionaryGet: () => Promise<unknown[]>;
  dictionaryAdd: (word: string, replacement: string, category?: string) => Promise<void>;
  dictionaryRemove: (word: string) => Promise<void>;
  dictionaryGetCategories: () => Promise<Array<{ id: string; name: string; color: string }>>;
  dictionaryAddCategory: (name: string, color: string) => Promise<void>;
  dictionaryRemoveCategory: (id: string) => Promise<void>;
  dictionaryImport: (format: 'json' | 'csv', data: string) => Promise<{ imported: number; skipped: number; errors: string[] }>;
  dictionaryExport: (format: 'json' | 'csv') => Promise<string>;

  // Models
  modelsList: () => Promise<Array<{ name: string; path: string; size: number; exists: boolean }>>;
  modelsDelete: (path: string) => Promise<boolean>;

  // Window
  windowHide: () => Promise<void>;
  windowShow: () => Promise<void>;

  // Text insertion
  textInsert: (text: string) => Promise<{
    success: boolean;
    method: 'paste' | 'clipboard' | 'type' | 'failed';
    error?: string;
    text: string;
    accessibilityRequired?: boolean;
  }>;

  // System status
  systemGetStatus: () => Promise<{
    audio: {
      ffmpegAvailable: boolean;
      hasAudioDevices: boolean;
      deviceCount: number;
    };
    transcription: {
      whisperInstalled: boolean;
      modelAvailable: boolean;
      hasCloudProvider: boolean;
      activeProvider?: string;
      cloudProviderType?: 'openai' | 'groq' | 'anthropic' | 'deepseek' | 'zhipu' | 'minimax' | 'moonshot';
      recommendations: string[];
    };
  }>;

  // Events
  onRecordingStarted: (callback: () => void) => () => void;
  onRecordingStopped: (callback: () => void) => () => void;
  onTranscriptionComplete: (callback: (result: TranscriptionResult) => void) => () => void;
  onNavigate: (callback: (path: string) => void) => () => void;
  onTranscriptionPartial: (callback: (chunk: { text: string; isPartial: boolean }) => void) => () => void;
  onTranscriptionFinal: (callback: (chunk: { text: string; isPartial: boolean }) => void) => () => void;

  profileGetAll: () => Promise<any[]>;
  profileGetCurrent: () => Promise<any | null>;
  profileSave: (profile: any) => Promise<void>;
  profileDelete: (profileId: string) => Promise<void>;

  transcriptionStartStream: () => Promise<{ success: boolean; error?: string }>;
  transcriptionStopStream: () => Promise<{ success: boolean }>;

  // Auto Update
  updateCheck: () => Promise<void>;
  updateDownload: () => Promise<void>;
  updateInstall: () => Promise<void>;
  updateGetState: () => Promise<{
    status: 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'error';
    version?: string;
    releaseNotes?: string;
    progress?: number;
    error?: string;
  }>;
  onUpdateState: (callback: (state: any) => void) => () => void;

  // App info
  appVersion: () => Promise<string>;
  appName: () => Promise<string>;
}

const api: ElectronAPI = {
  // Store
  storeGet: (key: string) => ipcRenderer.invoke('store:get', key),
  storeSet: (key: string, value: unknown) => ipcRenderer.invoke('store:set', key, value),

  // Recording
  recordingStart: () => ipcRenderer.invoke('recording:start'),
  recordingStop: () => ipcRenderer.invoke('recording:stop'),
  recordingGetState: () => ipcRenderer.invoke('recording:get-state'),

  // Audio Device Management
  audioGetDevices: () => ipcRenderer.invoke('audio:devices'),
  audioGetSelectedDevice: () => ipcRenderer.invoke('audio:get-selected-device'),
  audioSetSelectedDevice: (device) => ipcRenderer.invoke('audio:set-selected-device', device),

  // Diagnostics
  diagnosticsRun: () => ipcRenderer.invoke('diagnostics:run'),
  diagnosticsGetLastFailure: () => ipcRenderer.invoke('diagnostics:get-last-failure'),
  diagnosticsRequestPermission: (permissionType) => ipcRenderer.invoke('diagnostics:request-permission', permissionType),
  diagnosticsOpenSettings: (permissionType) => ipcRenderer.invoke('diagnostics:open-settings', permissionType),

  // Providers
  providersList: () => ipcRenderer.invoke('providers:list'),
  providersListTranscription: () => ipcRenderer.invoke('providers:list-transcription'),
  providersListPostProcessing: () => ipcRenderer.invoke('providers:list-post-processing'),
  providersGetConfig: (id: string) => ipcRenderer.invoke('providers:get-config', id),
  providersSetConfig: (id: string, config: unknown) => ipcRenderer.invoke('providers:set-config', id, config),
  providersTest: (id: string) => ipcRenderer.invoke('providers:test', id),

  aiGetSettings: () => ipcRenderer.invoke('ai:get-settings'),
  aiSetSettings: (settings: Partial<AiPostProcessingSettings>) => ipcRenderer.invoke('ai:set-settings', settings),
  aiTest: (text: string) => ipcRenderer.invoke('ai:test', text),

  // History
  historyGet: (limit: number) => ipcRenderer.invoke('history:get', limit),
  historyDelete: (id: string) => ipcRenderer.invoke('history:delete', id),
  historyClear: () => ipcRenderer.invoke('history:clear'),

  // Data Export
  exportHistory: (format: 'json' | 'csv') => ipcRenderer.invoke('export:history', format),
  exportDictionary: () => ipcRenderer.invoke('export:dictionary'),
  exportSettings: () => ipcRenderer.invoke('export:settings'),
  saveExportFile: (data: string, filename: string) => ipcRenderer.invoke('export:save-file', data, filename),

  // Data Cleanup
  getStorageStats: () => ipcRenderer.invoke('cleanup:storage-stats'),
  clearTemporaryFiles: (maxAgeHours?: number) => ipcRenderer.invoke('cleanup:clear-temp', maxAgeHours),
  clearAllData: (resetSettings: boolean) => ipcRenderer.invoke('cleanup:clear-all', resetSettings),

  // Dictionary
  dictionaryGet: () => ipcRenderer.invoke('dictionary:get'),
  dictionaryAdd: (word: string, replacement: string, category?: string) =>
    ipcRenderer.invoke('dictionary:add', word, replacement, category),
  dictionaryRemove: (word: string) => ipcRenderer.invoke('dictionary:remove', word),
  dictionaryGetCategories: () => ipcRenderer.invoke('dictionary:get-categories'),
  dictionaryAddCategory: (name: string, color: string) => ipcRenderer.invoke('dictionary:add-category', name, color),
  dictionaryRemoveCategory: (id: string) => ipcRenderer.invoke('dictionary:remove-category', id),
  dictionaryImport: (format: 'json' | 'csv', data: string) => ipcRenderer.invoke('dictionary:import', format, data),
  dictionaryExport: (format: 'json' | 'csv') => ipcRenderer.invoke('dictionary:export', format),

  // Models
  modelsList: () => ipcRenderer.invoke('models:list'),
  modelsDelete: (path: string) => ipcRenderer.invoke('models:delete', path),

  // Window
  windowHide: () => ipcRenderer.invoke('window:hide'),
  windowShow: () => ipcRenderer.invoke('window:show'),

  // Text
  textInsert: (text: string) => ipcRenderer.invoke('text:insert', text),

  // System status
  systemGetStatus: async () => {
    const [audio, transcription] = await Promise.all([
      ipcRenderer.invoke('audio:status'),
      ipcRenderer.invoke('transcription:status')
    ]);
    return { audio, transcription };
  },

  // Events
  onRecordingStarted: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on('recording:started', handler);
    return () => ipcRenderer.off('recording:started', handler);
  },
  onRecordingStopped: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on('recording:stopped', handler);
    return () => ipcRenderer.off('recording:stopped', handler);
  },
  onTranscriptionComplete: (callback: (result: TranscriptionResult) => void) => {
    const handler = (_: unknown, result: TranscriptionResult) => callback(result);
    ipcRenderer.on('transcription:complete', handler);
    return () => ipcRenderer.off('transcription:complete', handler);
  },
  onNavigate: (callback: (path: string) => void) => {
    const handler = (_: unknown, path: string) => callback(path);
    ipcRenderer.on('navigate', handler);
    return () => ipcRenderer.off('navigate', handler);
  },

  onTranscriptionPartial: (callback: (chunk: { text: string; isPartial: boolean }) => void) => {
    const handler = (_: unknown, chunk: { text: string; isPartial: boolean }) => callback(chunk);
    ipcRenderer.on('transcription:partial', handler);
    return () => ipcRenderer.off('transcription:partial', handler);
  },

  onTranscriptionFinal: (callback: (chunk: { text: string; isPartial: boolean }) => void) => {
    const handler = (_: unknown, chunk: { text: string; isPartial: boolean }) => callback(chunk);
    ipcRenderer.on('transcription:final', handler);
    return () => ipcRenderer.off('transcription:final', handler);
  },

  profileGetAll: () => ipcRenderer.invoke('profile:get-all'),
  profileGetCurrent: () => ipcRenderer.invoke('profile:get-current'),
  profileSave: (profile: any) => ipcRenderer.invoke('profile:save', profile),
  profileDelete: (profileId: string) => ipcRenderer.invoke('profile:delete', profileId),

  transcriptionStartStream: () => ipcRenderer.invoke('transcription:start-stream'),
  transcriptionStopStream: () => ipcRenderer.invoke('transcription:stop-stream'),

  // Auto Update
  updateCheck: () => ipcRenderer.invoke('update:check'),
  updateDownload: () => ipcRenderer.invoke('update:download'),
  updateInstall: () => ipcRenderer.invoke('update:install'),
  updateGetState: () => ipcRenderer.invoke('update:state'),
  onUpdateState: (callback: (state: any) => void) => {
    const handler = (_: unknown, state: any) => callback(state);
    ipcRenderer.on('update:state', handler);
    return () => ipcRenderer.off('update:state', handler);
  },

  // App info
  appVersion: () => ipcRenderer.invoke('app:version'),
  appName: () => ipcRenderer.invoke('app:name'),
};

contextBridge.exposeInMainWorld('electronAPI', api);
