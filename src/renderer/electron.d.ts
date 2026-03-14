export {};

declare global {
  interface Window {
    electronAPI: {
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
    };
  }
}
