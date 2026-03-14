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

      // Text insertion with detailed result
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
          recommendations: string[];
        };
      }>;

      // Events
      onRecordingStarted: (callback: () => void) => () => void;
      onRecordingStopped: (callback: () => void) => () => void;
      onTranscriptionComplete: (callback: (result: {
        text: string;
        success: boolean;
        provider: string;
        error?: string;
        fallbackToClipboard?: boolean;
      }) => void) => () => void;
      onNavigate: (callback: (path: string) => void) => () => void;
    };
  }
}
