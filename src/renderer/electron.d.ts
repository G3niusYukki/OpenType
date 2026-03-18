export {};

declare global {
  interface TextChange {
    type: 'filler' | 'repetition' | 'correction' | 'improvement';
    original: string;
    replacement: string;
    position: number;
    explanation?: string;
  }

  interface TranscriptionResult {
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

  interface AiPostProcessingSettings {
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

  interface Window {
    electronAPI: {
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

      // AI Post-Processing
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
    };
  }
}
