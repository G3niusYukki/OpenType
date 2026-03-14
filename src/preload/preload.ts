import { contextBridge, ipcRenderer } from 'electron';

/**
 * OpenType Preload Script
 * 
 * Exposes safe IPC channels to the renderer process
 * All API calls go through here for security isolation
 */

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

  // Text
  textInsert: (text: string) => Promise<boolean>;

  // Events
  onRecordingStarted: (callback: () => void) => () => void;
  onRecordingStopped: (callback: () => void) => () => void;
  onTranscriptionComplete: (callback: (text: string) => void) => () => void;
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
  onTranscriptionComplete: (callback: (text: string) => void) => {
    const handler = (_: unknown, text: string) => callback(text);
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

export type { ElectronAPI };
