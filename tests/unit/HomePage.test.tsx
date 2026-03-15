import React from 'react';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { HomePage } from '../../src/renderer/pages/HomePage';
import { I18nProvider } from '../../src/renderer/i18n';
import { createElectronAPIMock, MockTranscriptionResult } from './mocks/electronAPI';

const mockClipboard = {
  writeText: vi.fn(),
};
Object.defineProperty(navigator, 'clipboard', {
  value: mockClipboard,
  writable: true,
  configurable: true,
});

const { electronAPI, assignToWindow, resetElectronAPIMock } = createElectronAPIMock();

vi.mock('../../src/renderer/components/SystemStatusPanel', () => ({
  SystemStatusPanel: () => React.createElement('div', { 'data-testid': 'system-status-panel' }, 'System Status Panel'),
}));

vi.mock('../../src/renderer/i18n', async (importOriginal) => {
  const actual = await importOriginal() as typeof import('../../src/renderer/i18n');
  return {
    ...actual,
    useI18n: () => ({
      t: {
        home: {
          pressToStart: 'Press {hotkey} to start',
          recording: 'Recording...',
          transcribing: 'Transcribing...',
          copy: 'Copy',
          copied: 'Copied!',
          insertAtCursor: 'Insert at Cursor',
          inserted: 'Inserted!',
          transcriptionResult: 'Transcription Result',
          success: 'Success',
          textCopiedToClipboard: 'Text copied to clipboard (auto-insert unavailable)',
          emptyStateTitle: 'Your transcriptions will appear here',
          emptyStateSubtitle: 'Click the mic or press {hotkey} to start dictating',
          accessibilityRequired: 'Accessibility Permission Required',
          accessibilityMessage: 'OpenType needs Accessibility permission to paste text at your cursor.',
          openSettings: 'Open Settings → Privacy & Security → Accessibility',
        },
        status: {
          ready: 'Ready',
          notReady: 'Setup Required',
          checking: 'Checking...',
          clickToCollapse: 'Click to collapse',
          clickToExpand: 'Click to expand',
          audioRecording: 'Audio Recording',
          ffmpeg: 'ffmpeg',
          installed: 'Installed',
          notFound: 'Not found',
          microphone: 'Microphone',
          devices: 'device(s)',
          noDevices: 'No devices',
          transcription: 'Transcription',
          whisper: 'whisper.cpp',
          model: 'Model',
          modelFile: 'Model file',
          found: 'Found',
          cloudProvider: 'Cloud provider',
          configured: 'Configured',
          notConfigured: 'Not configured',
          active: 'Active',
          ffmpegRequired: 'ffmpeg is required for audio recording.',
          installCommand: 'Install with:',
          dependencies: 'Dependencies',
          readyToTranscribe: 'Ready to transcribe',
          using: 'Using',
          noProviderConfigured: 'No transcription provider configured',
          noProviderDescription: 'Install whisper.cpp + model for local transcription',
          loading: 'Loading system status...',
        },
      },
      language: 'en',
      setLanguage: vi.fn(),
      supportedLanguages: [
        { code: 'en', name: 'English', nativeName: 'English' },
        { code: 'zh', name: 'Chinese (Simplified)', nativeName: '简体中文' },
        { code: 'ja', name: 'Japanese', nativeName: '日本語' },
        { code: 'ko', name: 'Korean', nativeName: '한국어' },
      ],
      isLoading: false,
    }),
    I18nProvider: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children),
  };
});

const renderHomePage = () => {
  return render(
    React.createElement(I18nProvider, null,
      React.createElement(HomePage, null)
    )
  );
};

let recordingStartedCallback: (() => void) | null = null;
let recordingStoppedCallback: (() => void) | null = null;
let transcriptionCompleteCallback: ((result: MockTranscriptionResult) => void) | null = null;

const getRecordButton = () => screen.getAllByRole('button')[1];

describe('HomePage', () => {
  beforeEach(() => {
    recordingStartedCallback = null;
    recordingStoppedCallback = null;
    transcriptionCompleteCallback = null;
    assignToWindow();
    resetElectronAPIMock();
    mockClipboard.writeText.mockClear();

    electronAPI.onRecordingStarted.mockImplementation((callback: () => void) => {
      recordingStartedCallback = callback;
      return () => { recordingStartedCallback = null; };
    });

    electronAPI.onRecordingStopped.mockImplementation((callback: () => void) => {
      recordingStoppedCallback = callback;
      return () => { recordingStoppedCallback = null; };
    });

    electronAPI.onTranscriptionComplete.mockImplementation((callback: (result: MockTranscriptionResult) => void) => {
      transcriptionCompleteCallback = callback;
      return () => { transcriptionCompleteCallback = null; };
    });

    electronAPI.storeGet.mockResolvedValue(undefined);
    electronAPI.aiGetSettings.mockResolvedValue({
      enabled: false,
      options: {
        removeFillerWords: false,
        removeRepetition: false,
        detectSelfCorrection: false,
      },
      showComparison: false,
    });
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('Rendering', () => {
    it('should render initial state correctly', async () => {
      renderHomePage();

      expect(screen.getByTestId('system-status-panel')).toBeInTheDocument();
      expect(screen.getByText('Your transcriptions will appear here')).toBeInTheDocument();
      
      const micButton = getRecordButton();
      expect(micButton).toBeInTheDocument();
    });

    it('should display SystemStatusPanel', async () => {
      renderHomePage();
      expect(screen.getByTestId('system-status-panel')).toBeInTheDocument();
    });

    it('should show idle recording button state', async () => {
      renderHomePage();
      
      const buttons = screen.getAllByRole('button');
      const recordButton = buttons.find(btn => btn.querySelector('svg'));
      expect(recordButton).toBeInTheDocument();
      
      expect(screen.getByText(/Press.*to start/)).toBeInTheDocument();
    });
  });

  describe('Recording Flow', () => {
    it('should start recording when button is clicked', async () => {
      renderHomePage();

      await act(async () => {
        fireEvent.click(getRecordButton());
      });

      expect(electronAPI.recordingStart).toHaveBeenCalled();
    });

    it('should show recording in progress UI when recording starts', async () => {
      renderHomePage();

      await act(async () => {
        if (recordingStartedCallback) {
          recordingStartedCallback();
        }
      });

      await waitFor(() => {
        expect(screen.getByText('Recording...')).toBeInTheDocument();
      });
    });

    it('should show recording timer when recording', async () => {
      vi.useFakeTimers();
      renderHomePage();

      await act(async () => {
        if (recordingStartedCallback) {
          recordingStartedCallback();
        }
      });

      expect(screen.getByText('00:00')).toBeInTheDocument();

      vi.useRealTimers();
    });

    it('should stop recording when button is clicked during recording', async () => {
      renderHomePage();

      await act(async () => {
        if (recordingStartedCallback) {
          recordingStartedCallback();
        }
      });

      await act(async () => {
        fireEvent.click(getRecordButton());
      });

      expect(electronAPI.recordingStop).toHaveBeenCalled();
    });

    it('should show Square icon when recording', async () => {
      renderHomePage();

      await act(async () => {
        if (recordingStartedCallback) {
          recordingStartedCallback();
        }
      });

      expect(screen.getByText('Recording...')).toBeInTheDocument();
    });

    it('should display timer with correct format', async () => {
      vi.useFakeTimers();
      renderHomePage();

      await act(async () => {
        if (recordingStartedCallback) {
          recordingStartedCallback();
        }
      });

      await act(async () => {
        vi.advanceTimersByTime(65000);
      });

      expect(screen.getByText('01:05')).toBeInTheDocument();

      vi.useRealTimers();
    });
  });

  describe('Transcription Results', () => {
    it('should display raw transcription text', async () => {
      renderHomePage();

      const transcriptionResult: MockTranscriptionResult = {
        text: 'Hello world this is a test',
        rawText: 'Hello world this is a test',
        success: true,
        provider: 'whisper.cpp',
      };

      await act(async () => {
        if (transcriptionCompleteCallback) {
          transcriptionCompleteCallback(transcriptionResult);
        }
      });

      expect(screen.getByText('Hello world this is a test')).toBeInTheDocument();
      expect(screen.getByText('Transcription Result')).toBeInTheDocument();
    });

    it('should display AI-processed text when available', async () => {
      electronAPI.aiGetSettings.mockResolvedValue({
        enabled: true,
        options: {
          removeFillerWords: true,
          removeRepetition: true,
          detectSelfCorrection: true,
        },
        showComparison: false,
      });

      renderHomePage();

      const transcriptionResult: MockTranscriptionResult = {
        text: 'Hello world this is polished text',
        rawText: 'Hello world um this is a test',
        processedText: 'Hello world this is polished text',
        success: true,
        provider: 'whisper.cpp',
        aiProcessed: true,
        aiProvider: 'openai',
        aiLatency: 450,
        aiChanges: [
          { type: 'filler', original: 'um', replacement: '', position: 12, explanation: 'Removed filler word' },
        ],
      };

      await act(async () => {
        if (transcriptionCompleteCallback) {
          transcriptionCompleteCallback(transcriptionResult);
        }
      });

      await waitFor(() => {
        expect(screen.getByText(/AI polish/)).toBeInTheDocument();
      });

      expect(screen.getByText('450ms')).toBeInTheDocument();
    });

    it('should allow toggling between raw and processed text', async () => {
      electronAPI.aiGetSettings.mockResolvedValue({
        enabled: true,
        options: {
          removeFillerWords: true,
          removeRepetition: true,
          detectSelfCorrection: true,
        },
        showComparison: false,
      });

      renderHomePage();

      const transcriptionResult: MockTranscriptionResult = {
        text: 'Polished text',
        rawText: 'Raw um text',
        processedText: 'Polished text',
        success: true,
        provider: 'whisper.cpp',
        aiProcessed: true,
      };

      await act(async () => {
        if (transcriptionCompleteCallback) {
          transcriptionCompleteCallback(transcriptionResult);
        }
      });

      await waitFor(() => {
        expect(screen.getByText('Polished')).toBeInTheDocument();
        expect(screen.getByText('Original')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Original'));

      await waitFor(() => {
        expect(screen.getByText('Raw um text')).toBeInTheDocument();
      });
    });

    it('should show provider display', async () => {
      renderHomePage();

      const transcriptionResult: MockTranscriptionResult = {
        text: 'Test transcription',
        success: true,
        provider: 'openai',
      };

      await act(async () => {
        if (transcriptionCompleteCallback) {
          transcriptionCompleteCallback(transcriptionResult);
        }
      });

      expect(screen.getByText(/via openai/)).toBeInTheDocument();
    });

    it('should show copy to clipboard button', async () => {
      renderHomePage();

      const transcriptionResult: MockTranscriptionResult = {
        text: 'Test transcription',
        success: true,
        provider: 'whisper.cpp',
      };

      await act(async () => {
        if (transcriptionCompleteCallback) {
          transcriptionCompleteCallback(transcriptionResult);
        }
      });

      const copyButton = screen.getByRole('button', { name: /Copy/ });
      expect(copyButton).toBeInTheDocument();
    });

    it('should copy text to clipboard when copy button is clicked', async () => {
      renderHomePage();

      const transcriptionResult: MockTranscriptionResult = {
        text: 'Test transcription to copy',
        success: true,
        provider: 'whisper.cpp',
      };

      await act(async () => {
        if (transcriptionCompleteCallback) {
          transcriptionCompleteCallback(transcriptionResult);
        }
      });

      const copyButton = screen.getByRole('button', { name: /Copy/ });
      
      await act(async () => {
        fireEvent.click(copyButton);
      });

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('Test transcription to copy');
    });

    it('should show success indicator for successful transcription', async () => {
      renderHomePage();

      const transcriptionResult: MockTranscriptionResult = {
        text: 'Test transcription',
        success: true,
        provider: 'whisper.cpp',
      };

      await act(async () => {
        if (transcriptionCompleteCallback) {
          transcriptionCompleteCallback(transcriptionResult);
        }
      });

      expect(screen.getByText(/Success/)).toBeInTheDocument();
    });
  });

  describe('Provider Selection', () => {
    it('should display active provider', async () => {
      electronAPI.storeGet.mockImplementation((key: string) => {
        if (key === 'preferredProvider') return Promise.resolve('local');
        return Promise.resolve(undefined);
      });

      renderHomePage();

      await waitFor(() => {
        expect(screen.getByText('Local (whisper.cpp)')).toBeInTheDocument();
      });
    });

    it('should open provider dropdown when clicked', async () => {
      renderHomePage();

      const providerButton = screen.getByText(/Auto|Local|Cloud/);
      
      await act(async () => {
        fireEvent.click(providerButton);
      });

      expect(screen.getAllByText('Auto (Local first)')).toHaveLength(2);
      expect(screen.getByText('Local (whisper.cpp)')).toBeInTheDocument();
      expect(screen.getByText('Cloud (API)')).toBeInTheDocument();
    });

    it('should allow selecting different provider', async () => {
      renderHomePage();

      const providerButton = screen.getByText(/Auto|Local|Cloud/);
      
      await act(async () => {
        fireEvent.click(providerButton);
      });

      await waitFor(() => {
        expect(screen.getByText('Cloud (API)')).toBeInTheDocument();
      });

      await act(async () => {
        fireEvent.click(screen.getByText('Cloud (API)'));
      });

      expect(electronAPI.storeSet).toHaveBeenCalledWith('preferredProvider', 'cloud');
    });

    it('should show correct provider icon', async () => {
      electronAPI.storeGet.mockImplementation((key: string) => {
        if (key === 'preferredProvider') return Promise.resolve('cloud');
        return Promise.resolve(undefined);
      });

      renderHomePage();

      await waitFor(() => {
        expect(screen.getByText('Cloud (API)')).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('should display transcription error', async () => {
      renderHomePage();

      const errorResult: MockTranscriptionResult = {
        text: 'Transcription failed',
        success: false,
        provider: 'none',
        error: 'Microphone permission denied',
      };

      await act(async () => {
        if (transcriptionCompleteCallback) {
          transcriptionCompleteCallback(errorResult);
        }
      });

      expect(screen.getByText('Transcription failed')).toBeInTheDocument();
    });

    it('should show fallback to clipboard mode warning', async () => {
      renderHomePage();

      const fallbackResult: MockTranscriptionResult = {
        text: 'Test transcription',
        success: true,
        provider: 'whisper.cpp',
        fallbackToClipboard: true,
      };

      await act(async () => {
        if (transcriptionCompleteCallback) {
          transcriptionCompleteCallback(fallbackResult);
        }
      });

      expect(screen.getByText(/Text copied to clipboard/)).toBeInTheDocument();
    });

    it('should display accessibility permission error', async () => {
      electronAPI.textInsert.mockResolvedValue({
        success: false,
        method: 'clipboard',
        text: '',
        accessibilityRequired: true,
      });

      renderHomePage();

      const transcriptionResult: MockTranscriptionResult = {
        text: 'Test transcription',
        success: true,
        provider: 'whisper.cpp',
      };

      await act(async () => {
        if (transcriptionCompleteCallback) {
          transcriptionCompleteCallback(transcriptionResult);
        }
      });

      const insertButton = screen.getByRole('button', { name: /Insert at Cursor/ });
      
      await act(async () => {
        fireEvent.click(insertButton);
      });

      await waitFor(() => {
        expect(screen.getByText('Accessibility Permission Required')).toBeInTheDocument();
      });
    });
  });

  describe('Audio Waveform', () => {
    it('should render waveform visualization', async () => {
      renderHomePage();

      const waveformContainer = document.querySelector('[style*="display: flex"]');
      expect(waveformContainer).toBeInTheDocument();
    });

    it('should show animated state when recording', async () => {
      renderHomePage();

      expect(screen.queryByText('Recording...')).not.toBeInTheDocument();

      await act(async () => {
        if (recordingStartedCallback) {
          recordingStartedCallback();
        }
      });

      await waitFor(() => {
        expect(screen.getByText('Recording...')).toBeInTheDocument();
      });
    });

    it('should show static state when not recording', async () => {
      renderHomePage();

      expect(screen.getByText(/Press.*to start/)).toBeInTheDocument();
    });
  });

  describe('Text Insertion', () => {
    it('should insert text at cursor when insert button is clicked', async () => {
      electronAPI.textInsert.mockResolvedValue({
        success: true,
        method: 'paste',
        text: 'Test transcription',
        accessibilityRequired: false,
      });

      renderHomePage();

      const transcriptionResult: MockTranscriptionResult = {
        text: 'Test transcription',
        success: true,
        provider: 'whisper.cpp',
      };

      await act(async () => {
        if (transcriptionCompleteCallback) {
          transcriptionCompleteCallback(transcriptionResult);
        }
      });

      const insertButton = screen.getByRole('button', { name: /Insert at Cursor/ });
      
      await act(async () => {
        fireEvent.click(insertButton);
      });

      expect(electronAPI.textInsert).toHaveBeenCalledWith('Test transcription');
    });

    it('should show inserted state after successful insertion', async () => {
      electronAPI.textInsert.mockResolvedValue({
        success: true,
        method: 'paste',
        text: 'Test transcription',
        accessibilityRequired: false,
      });

      renderHomePage();

      const transcriptionResult: MockTranscriptionResult = {
        text: 'Test transcription',
        success: true,
        provider: 'whisper.cpp',
      };

      await act(async () => {
        if (transcriptionCompleteCallback) {
          transcriptionCompleteCallback(transcriptionResult);
        }
      });

      const insertButton = screen.getByRole('button', { name: /Insert at Cursor/ });
      
      await act(async () => {
        fireEvent.click(insertButton);
      });

      await waitFor(() => {
        expect(screen.getByText('Inserted!')).toBeInTheDocument();
      });
    });
  });

  describe('Hotkey Display', () => {
    it('should display loaded hotkey', async () => {
      electronAPI.storeGet.mockImplementation((key: string) => {
        if (key === 'hotkey') return Promise.resolve('CommandOrControl+Shift+D');
        return Promise.resolve(undefined);
      });

      renderHomePage();

      expect(screen.getAllByText(/⌘⇧D/)).toHaveLength(2);
    });

    it('should show default hotkey when none is saved', async () => {
      renderHomePage();

      await waitFor(() => {
        expect(screen.getByText(/Press/)).toBeInTheDocument();
      });
    });
  });
});
