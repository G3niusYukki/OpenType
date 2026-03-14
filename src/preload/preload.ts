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

  // Providers
  providersList: () => Promise<unknown[]>;
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

  // Dictionary
  dictionaryGet: () => Promise<unknown[]>;
  dictionaryAdd: (word: string, replacement: string) => Promise<void>;
  dictionaryRemove: (word: string) => Promise<void>;

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
      cloudProviderType?: 'openai' | 'groq' | 'anthropic';
      recommendations: string[];
    };
  }>;

  // Events
  onRecordingStarted: (callback: () => void) => () => void;
  onRecordingStopped: (callback: () => void) => () => void;
  onTranscriptionComplete: (callback: (result: TranscriptionResult) => void) => () => void;
  onNavigate: (callback: (path: string) => void) => () => void;
}

const api: ElectronAPI = {
  // Store
  storeGet: (key: string) => ipcRenderer.invoke('store:get', key),
  storeSet: (key: string, value: unknown) => ipcRenderer.invoke('store:set', key, value),

  // Recording
  recordingStart: () => ipcRenderer.invoke('recording:start'),
  recordingStop: () => ipcRenderer.invoke('recording:stop'),
  recordingGetState: () => ipcRenderer.invoke('recording:get-state'),

  // Providers
  providersList: () => ipcRenderer.invoke('providers:list'),
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

  // Dictionary
  dictionaryGet: () => ipcRenderer.invoke('dictionary:get'),
  dictionaryAdd: (word: string, replacement: string) => ipcRenderer.invoke('dictionary:add', word, replacement),
  dictionaryRemove: (word: string) => ipcRenderer.invoke('dictionary:remove', word),

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
};

contextBridge.exposeInMainWorld('electronAPI', api);
