import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react';
import { SettingsPage } from '../../../src/renderer/pages/SettingsPage/SettingsPage';
import { createElectronAPIMock } from '../mocks';

// Mock i18n
vi.mock('../../../src/renderer/i18n', () => ({
  useI18n: () => ({
    t: {
      settings: {
        title: 'Settings',
        general: 'General',
        hotkey: 'Global Hotkey',
        hotkeyDescription: 'Keyboard shortcut to start/stop recording',
        transcriptionLanguage: 'Transcription Language',
        transcriptionLanguageDescription: 'Language used for speech recognition',
        autoPunctuation: 'Auto Punctuation',
        autoPunctuationDescription: 'Automatically add punctuation to transcriptions',
        preferredProvider: 'Preferred Provider',
        preferredProviderDescription: 'Choose which transcription provider to use',
        preferredProviderAuto: 'Auto (Local first, fallback to Cloud)',
        preferredProviderLocal: 'Local (whisper.cpp only)',
        preferredProviderCloud: 'Cloud (API only)',
        transcriptionProviders: 'Transcription Providers',
        transcriptionProvidersDescription: 'Configure speech-to-text services for audio transcription',
        postProcessingProviders: 'Post-Processing Providers',
        postProcessingProvidersDescription: 'Configure AI providers for text optimization and polishing',
        apiKey: 'API Key',
        model: 'Model',
        baseUrl: 'Base URL',
        test: 'Test',
        testing: 'Testing...',
        enabled: 'Enabled',
        aiPostProcessing: 'AI Post-Processing',
        enableAiPostProcessing: 'Enable AI Post-Processing',
        aiPostProcessingDescription: 'Use AI to improve transcription quality',
        processingOptions: 'Processing Options',
        removeFillerWords: 'Remove filler words (um, uh, like)',
        removeRepetition: 'Remove repetition',
        detectSelfCorrection: 'Detect self-correction',
        showComparison: 'Show before/after comparison',
        aiAvailable: 'AI provider configured and ready',
        configureAiProvider: 'Configure an AI provider above to enable post-processing',
        using: 'Using',
      },
      status: {
        title: 'System Status',
        dependencies: 'Dependencies',
        ffmpeg: 'FFmpeg',
        installed: 'Installed',
        notFound: 'Not Found',
        microphone: 'Microphone',
        devices: 'devices',
        whisper: 'Whisper',
        modelFile: 'Model File',
        found: 'Found',
        readyToTranscribe: 'Ready to transcribe',
        noProviderConfigured: 'No transcription provider configured',
        noProviderDescription: 'Enable a provider below to start transcribing',
        loading: 'Loading system status...',
      },
    },
  }),
}));

const { electronAPI, assignToWindow, resetElectronAPIMock } = createElectronAPIMock();

// Helper to click the General tab before assertions
const renderSettingsAndGoToGeneral = async () => {
  let result: ReturnType<typeof render>;
  // Wrap render in act() so React properly batches state updates from microtasks
  await act(async () => {
    result = render(<SettingsPage />);
    vi.runAllTimers();
  });
  return result!;
};

describe('SettingsPage', () => {
  beforeEach(() => {
    assignToWindow();
    resetElectronAPIMock();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ============================================================================
  // RENDERING TESTS
  // ============================================================================
  describe('Rendering', () => {
    it('should render with loaded settings on General tab', async () => {
      electronAPI.storeGet.mockImplementation((key: string) => {
        const settings: Record<string, unknown> = {
          hotkey: 'CommandOrControl+Shift+D',
          language: 'en-US',
          autoPunctuation: true,
          preferredProvider: 'auto',
          voiceInputModes: {
            basicVoiceInput: true,
            handsFreeMode: true,
            translateToEnglish: true,
            editSelectedText: true,
          },
        };
        return Promise.resolve(settings[key]);
      });

      electronAPI.aiGetSettings.mockResolvedValue({
        enabled: false,
        options: {
          removeFillerWords: true,
          removeRepetition: true,
          detectSelfCorrection: true,
        },
        showComparison: true,
      });

      electronAPI.systemGetStatus.mockResolvedValue({
        audio: { ffmpegAvailable: true, hasAudioDevices: true, deviceCount: 2 },
        transcription: {
          whisperInstalled: true,
          modelAvailable: true,
          hasCloudProvider: false,
          activeProvider: 'whisper',
          recommendations: [],
        },
      });

      electronAPI.providersListTranscription.mockResolvedValue([]);
      electronAPI.providersListPostProcessing.mockResolvedValue([]);

      await renderSettingsAndGoToGeneral();

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument();
      });

      expect(screen.getByRole('button', { name: 'General' })).toBeInTheDocument();
      expect(screen.getByDisplayValue('CommandOrControl+Shift+D')).toBeInTheDocument();
    });

    it('should display 5 tabs', async () => {
      await renderSettingsAndGoToGeneral();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'General' })).toBeInTheDocument();
      });

      expect(screen.getByText('Transcription')).toBeInTheDocument();
      expect(screen.getByText('AI')).toBeInTheDocument();
      expect(screen.getByText('Voice Modes')).toBeInTheDocument();
      expect(screen.getByText('Data')).toBeInTheDocument();
    });

    it('should display system status in General tab', async () => {
      electronAPI.systemGetStatus.mockResolvedValue({
        audio: { ffmpegAvailable: true, hasAudioDevices: true, deviceCount: 2 },
        transcription: {
          whisperInstalled: true,
          modelAvailable: true,
          hasCloudProvider: false,
          activeProvider: 'whisper',
          recommendations: [],
        },
      });

      electronAPI.storeGet.mockResolvedValue(undefined);
      electronAPI.aiGetSettings.mockResolvedValue({
        enabled: false,
        options: { removeFillerWords: false, removeRepetition: false, detectSelfCorrection: false },
        showComparison: false,
      });
      electronAPI.providersListTranscription.mockResolvedValue([]);
      electronAPI.providersListPostProcessing.mockResolvedValue([]);

      await renderSettingsAndGoToGeneral();

      expect(screen.getByText('Ready to transcribe')).toBeInTheDocument();
      expect(screen.getByText('FFmpeg')).toBeInTheDocument();
      expect(screen.getByText('Microphone')).toBeInTheDocument();
      expect(screen.getByText('Whisper.cpp')).toBeInTheDocument();
      expect(screen.getByText('Model File')).toBeInTheDocument();
    });
  });

  // ============================================================================
  // HOTKEY CONFIGURATION TESTS
  // ============================================================================
  describe('Hotkey configuration', () => {
    beforeEach(() => {
      electronAPI.storeGet.mockResolvedValue(undefined);
      electronAPI.aiGetSettings.mockResolvedValue({
        enabled: false,
        options: { removeFillerWords: false, removeRepetition: false, detectSelfCorrection: false },
        showComparison: false,
      });
      electronAPI.systemGetStatus.mockResolvedValue({
        audio: { ffmpegAvailable: true, hasAudioDevices: true, deviceCount: 1 },
        transcription: {
          whisperInstalled: true,
          modelAvailable: true,
          hasCloudProvider: false,
          recommendations: [],
        },
      });
      electronAPI.providersListTranscription.mockResolvedValue([]);
      electronAPI.providersListPostProcessing.mockResolvedValue([]);
    });

    it('should display current hotkey', async () => {
      electronAPI.storeGet.mockImplementation((key: string) => {
        if (key === 'hotkey') return Promise.resolve('CommandOrControl+Shift+Space');
        return Promise.resolve(undefined);
      });

      await renderSettingsAndGoToGeneral();

      await waitFor(() => {
        expect(screen.getByDisplayValue('CommandOrControl+Shift+Space')).toBeInTheDocument();
      });
    });

    it('should change hotkey', async () => {
      await renderSettingsAndGoToGeneral();

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument();
      });

      const hotkeyInput = screen.getByDisplayValue('CommandOrControl+Shift+D');
      fireEvent.change(hotkeyInput, { target: { value: 'CommandOrControl+Alt+Space' } });

      expect(hotkeyInput).toHaveValue('CommandOrControl+Alt+Space');
    });

    it('should save on hotkey change', async () => {
      await renderSettingsAndGoToGeneral();

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument();
      });

      const hotkeyInput = screen.getByDisplayValue('CommandOrControl+Shift+D');
      fireEvent.change(hotkeyInput, { target: { value: 'CommandOrControl+Alt+Space' } });

      // Wait for the save debounce
      vi.advanceTimersByTime(400);

      await waitFor(() => {
        expect(electronAPI.storeSet).toHaveBeenCalledWith('hotkey', 'CommandOrControl+Alt+Space');
      });
    });
  });

  // ============================================================================
  // TRANSCRIPTION TAB TESTS
  // ============================================================================
  describe('Transcription tab', () => {
    beforeEach(() => {
      electronAPI.storeGet.mockResolvedValue(undefined);
      electronAPI.aiGetSettings.mockResolvedValue({
        enabled: false,
        options: { removeFillerWords: false, removeRepetition: false, detectSelfCorrection: false },
        showComparison: false,
      });
      electronAPI.systemGetStatus.mockResolvedValue({
        audio: { ffmpegAvailable: true, hasAudioDevices: true, deviceCount: 1 },
        transcription: {
          whisperInstalled: true,
          modelAvailable: true,
          hasCloudProvider: false,
          recommendations: [],
        },
      });
      electronAPI.providersListPostProcessing.mockResolvedValue([]);
    });

    it('should display provider list in Transcription tab', async () => {
      const mockProviders = [
        {
          id: 'openai',
          name: 'OpenAI',
          description: 'Cloud transcription via OpenAI API',
          requireApiKey: true,
          defaultBaseUrl: 'https://api.openai.com/v1',
          defaultModel: 'whisper-1',
          supportedModels: ['whisper-1'],
          category: 'transcription',
        },
        {
          id: 'groq',
          name: 'Groq',
          description: 'Fast cloud transcription via Groq',
          requireApiKey: true,
          defaultBaseUrl: 'https://api.groq.com/openai/v1',
          defaultModel: 'whisper-large-v3',
          supportedModels: ['whisper-large-v3', 'whisper-large-v3-turbo'],
          category: 'transcription',
        },
      ];

      electronAPI.providersListTranscription.mockResolvedValue(mockProviders);

      await renderSettingsAndGoToGeneral();

      // Click Transcription tab and flush async effects
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Transcription' }));
        vi.runAllTimers();
      });

      expect(screen.getByText('OpenAI')).toBeInTheDocument();
      expect(screen.getByText('Cloud transcription via OpenAI API')).toBeInTheDocument();
      expect(screen.getByText('Groq')).toBeInTheDocument();
    });

    it('should enable/disable provider toggle in Transcription tab', async () => {
      const mockTranscriptionProvider = {
        id: 'openai',
        name: 'OpenAI',
        description: 'Cloud transcription via OpenAI API',
        requireApiKey: true,
        defaultBaseUrl: 'https://api.openai.com/v1',
        defaultModel: 'whisper-1',
        supportedModels: ['whisper-1'],
        category: 'transcription',
      };

      electronAPI.providersListTranscription.mockResolvedValue([mockTranscriptionProvider]);

      await renderSettingsAndGoToGeneral();

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Transcription' }));
        vi.runAllTimers();
      });

      expect(screen.getByText('OpenAI')).toBeInTheDocument();

      const toggleButton = screen.getByText('Disabled');
      fireEvent.click(toggleButton);

      await waitFor(() => {
        expect(electronAPI.providersSetConfig).toHaveBeenCalledWith(
          'openai',
          expect.objectContaining({ enabledForTranscription: true })
        );
      });
    });

    it('should display API key input (masked)', async () => {
      electronAPI.providersListTranscription.mockResolvedValue([{
        id: 'openai',
        name: 'OpenAI',
        description: 'Cloud transcription via OpenAI API',
        requireApiKey: true,
        defaultBaseUrl: 'https://api.openai.com/v1',
        defaultModel: 'whisper-1',
        supportedModels: ['whisper-1'],
        category: 'transcription',
      }]);

      electronAPI.storeGet.mockImplementation((key: string) => {
        if (key === 'providers') {
          return Promise.resolve([
            { id: 'openai', enabled: true, enabledForTranscription: true, apiKey: 'sk-test123' },
          ]);
        }
        return Promise.resolve(undefined);
      });

      await renderSettingsAndGoToGeneral();

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Transcription' }));
        vi.runAllTimers();
      });

      expect(screen.getByText('OpenAI')).toBeInTheDocument();

      await waitFor(() => {
        const apiKeyInput = screen.getByPlaceholderText('OpenAI API key');
        expect(apiKeyInput).toHaveAttribute('type', 'password');
        expect(apiKeyInput).toHaveValue('sk-test123');
      });
    });

    it('should configure base URL', async () => {
      electronAPI.providersListTranscription.mockResolvedValue([{
        id: 'openai',
        name: 'OpenAI',
        description: 'Cloud transcription via OpenAI API',
        requireApiKey: true,
        defaultBaseUrl: 'https://api.openai.com/v1',
        defaultModel: 'whisper-1',
        supportedModels: ['whisper-1'],
        category: 'transcription',
      }]);

      electronAPI.storeGet.mockImplementation((key: string) => {
        if (key === 'providers') {
          return Promise.resolve([
            { id: 'openai', enabled: true, enabledForTranscription: true, apiKey: 'sk-test' },
          ]);
        }
        return Promise.resolve(undefined);
      });

      await renderSettingsAndGoToGeneral();

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Transcription' }));
        vi.runAllTimers();
      });

      expect(screen.getByText('OpenAI')).toBeInTheDocument();
      expect(screen.getByDisplayValue('https://api.openai.com/v1')).toBeInTheDocument();

      const baseUrlInput = screen.getByDisplayValue('https://api.openai.com/v1');
      fireEvent.change(baseUrlInput, { target: { value: 'https://custom.openai.com/v1' } });

      vi.advanceTimersByTime(400);

      await waitFor(() => {
        expect(electronAPI.providersSetConfig).toHaveBeenCalledWith(
          'openai',
          expect.objectContaining({ baseUrl: 'https://custom.openai.com/v1' })
        );
      });
    });

    it('should show test connection button', async () => {
      electronAPI.providersListTranscription.mockResolvedValue([{
        id: 'openai',
        name: 'OpenAI',
        description: 'Cloud transcription via OpenAI API',
        requireApiKey: true,
        defaultBaseUrl: 'https://api.openai.com/v1',
        defaultModel: 'whisper-1',
        supportedModels: ['whisper-1'],
        category: 'transcription',
      }]);

      electronAPI.storeGet.mockImplementation((key: string) => {
        if (key === 'providers') {
          return Promise.resolve([
            { id: 'openai', enabled: true, enabledForTranscription: true, apiKey: 'sk-test' },
          ]);
        }
        return Promise.resolve(undefined);
      });

      await renderSettingsAndGoToGeneral();

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Transcription' }));
        vi.runAllTimers();
      });

      expect(screen.getByRole('button', { name: /Test Connection/i })).toBeInTheDocument();
    });

    it('should show test success feedback', async () => {
      electronAPI.providersTest.mockResolvedValue({ success: true });

      electronAPI.providersListTranscription.mockResolvedValue([{
        id: 'openai',
        name: 'OpenAI',
        description: 'Cloud transcription via OpenAI API',
        requireApiKey: true,
        defaultBaseUrl: 'https://api.openai.com/v1',
        defaultModel: 'whisper-1',
        supportedModels: ['whisper-1'],
        category: 'transcription',
      }]);

      electronAPI.storeGet.mockImplementation((key: string) => {
        if (key === 'providers') {
          return Promise.resolve([
            { id: 'openai', enabled: true, enabledForTranscription: true, apiKey: 'sk-test' },
          ]);
        }
        return Promise.resolve(undefined);
      });

      await renderSettingsAndGoToGeneral();

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Transcription' }));
        vi.runAllTimers();
      });

      expect(screen.getByRole('button', { name: /Test Connection/i })).toBeInTheDocument();

      const testButton = screen.getByRole('button', { name: /Test Connection/i });
      fireEvent.click(testButton);

      await waitFor(() => {
        expect(screen.getByText('Connected')).toBeInTheDocument();
      });
    });

    it('should show test error feedback', async () => {
      electronAPI.providersTest.mockResolvedValue({ success: false, error: 'Invalid API key' });

      electronAPI.providersListTranscription.mockResolvedValue([{
        id: 'openai',
        name: 'OpenAI',
        description: 'Cloud transcription via OpenAI API',
        requireApiKey: true,
        defaultBaseUrl: 'https://api.openai.com/v1',
        defaultModel: 'whisper-1',
        supportedModels: ['whisper-1'],
        category: 'transcription',
      }]);

      electronAPI.storeGet.mockImplementation((key: string) => {
        if (key === 'providers') {
          return Promise.resolve([
            { id: 'openai', enabled: true, enabledForTranscription: true, apiKey: 'sk-invalid' },
          ]);
        }
        return Promise.resolve(undefined);
      });

      await renderSettingsAndGoToGeneral();

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Transcription' }));
        vi.runAllTimers();
      });

      expect(screen.getByRole('button', { name: /Test Connection/i })).toBeInTheDocument();

      const testButton = screen.getByRole('button', { name: /Test Connection/i });
      fireEvent.click(testButton);

      await waitFor(() => {
        expect(screen.getByText('Invalid API key')).toBeInTheDocument();
      });
    });
  });

  // ============================================================================
  // AI SETTINGS TESTS
  // ============================================================================
  describe('AI tab', () => {
    beforeEach(() => {
      electronAPI.storeGet.mockResolvedValue(undefined);
      electronAPI.systemGetStatus.mockResolvedValue({
        audio: { ffmpegAvailable: true, hasAudioDevices: true, deviceCount: 1 },
        transcription: {
          whisperInstalled: true,
          modelAvailable: true,
          hasCloudProvider: false,
          recommendations: [],
        },
      });
      electronAPI.providersListTranscription.mockResolvedValue([]);
      electronAPI.providersListPostProcessing.mockResolvedValue([]);
    });

    it('should render AI tab and toggle AI post-processing', async () => {
      electronAPI.aiGetSettings.mockResolvedValue({
        enabled: false,
        options: { removeFillerWords: false, removeRepetition: false, detectSelfCorrection: false },
        showComparison: false,
      });

      await renderSettingsAndGoToGeneral();

      // Click AI tab and flush all async effects
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'AI' }));
        vi.runAllTimers();
      });

      expect(screen.getByText('Enable AI Post-Processing')).toBeInTheDocument();

      const enableSwitch = screen.getByRole('switch', { name: /^Enable AI Post-Processing/i });
      fireEvent.click(enableSwitch);

      await waitFor(() => {
        expect(electronAPI.aiSetSettings).toHaveBeenCalledWith({ enabled: true });
      });
    });

    it('should configure options (filler words, repetition, self-correction)', async () => {
      electronAPI.aiGetSettings.mockResolvedValue({
        enabled: true,
        options: { removeFillerWords: true, removeRepetition: true, detectSelfCorrection: true },
        showComparison: true,
      });

      await renderSettingsAndGoToGeneral();

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'AI' }));
        vi.runAllTimers();
      });

      expect(screen.getByText('Remove Filler Words')).toBeInTheDocument();

      const fillerSwitch = screen.getByRole('switch', { name: /^Remove Filler Words/i });
      expect(fillerSwitch).toBeChecked();

      fireEvent.click(fillerSwitch);

      await waitFor(() => {
        expect(electronAPI.aiSetSettings).toHaveBeenCalledWith({
          options: expect.objectContaining({ removeFillerWords: false }),
        });
      });
    });

    it('should show comparison toggle', async () => {
      electronAPI.aiGetSettings.mockResolvedValue({
        enabled: true,
        options: { removeFillerWords: false, removeRepetition: false, detectSelfCorrection: false },
        showComparison: true,
      });

      await renderSettingsAndGoToGeneral();

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'AI' }));
        vi.runAllTimers();
      });

      expect(screen.getByText('Show Comparison')).toBeInTheDocument();

      const comparisonSwitch = screen.getByRole('switch', { name: /^Show Comparison/i });
      expect(comparisonSwitch).toBeChecked();
    });
  });

  // ============================================================================
  // VOICE INPUT MODES TESTS
  // ============================================================================
  describe('Voice tab', () => {
    beforeEach(() => {
      electronAPI.systemGetStatus.mockResolvedValue({
        audio: { ffmpegAvailable: true, hasAudioDevices: true, deviceCount: 1 },
        transcription: {
          whisperInstalled: true,
          modelAvailable: true,
          hasCloudProvider: false,
          recommendations: [],
        },
      });
      electronAPI.providersListTranscription.mockResolvedValue([]);
      electronAPI.providersListPostProcessing.mockResolvedValue([]);
      electronAPI.aiGetSettings.mockResolvedValue({
        enabled: false,
        options: { removeFillerWords: false, removeRepetition: false, detectSelfCorrection: false },
        showComparison: false,
      });
    });

    it('should toggle basic voice input in Voice tab', async () => {
      electronAPI.storeGet.mockImplementation((key: string) => {
        if (key === 'voiceInputModes') {
          return Promise.resolve({
            basicVoiceInput: true,
            handsFreeMode: true,
            translateToEnglish: true,
            editSelectedText: true,
          });
        }
        return Promise.resolve(undefined);
      });

      await renderSettingsAndGoToGeneral();

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Voice Modes' }));
        vi.runAllTimers();
      });

      expect(screen.getByText('Basic Voice Input')).toBeInTheDocument();

      const basicSwitch = screen.getByRole('switch', { name: /^Basic Voice Input/i });
      expect(basicSwitch).toBeChecked();

      fireEvent.click(basicSwitch);

      vi.advanceTimersByTime(400);

      await waitFor(() => {
        expect(electronAPI.storeSet).toHaveBeenCalledWith(
          'voiceInputModes',
          expect.objectContaining({ basicVoiceInput: false })
        );
      });
    });

    it('should toggle hands-free mode', async () => {
      electronAPI.storeGet.mockImplementation((key: string) => {
        if (key === 'voiceInputModes') {
          return Promise.resolve({
            basicVoiceInput: true,
            handsFreeMode: false,
            translateToEnglish: true,
            editSelectedText: true,
          });
        }
        return Promise.resolve(undefined);
      });

      await renderSettingsAndGoToGeneral();

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Voice Modes' }));
        vi.runAllTimers();
      });

      expect(screen.getByText('Hands-free Mode')).toBeInTheDocument();

      const handsFreeSwitch = screen.getByRole('switch', { name: /^Hands-free Mode/i });
      expect(handsFreeSwitch).not.toBeChecked();
    });

    it('should toggle translate to English', async () => {
      electronAPI.storeGet.mockImplementation((key: string) => {
        if (key === 'voiceInputModes') {
          return Promise.resolve({
            basicVoiceInput: true,
            handsFreeMode: true,
            translateToEnglish: false,
            editSelectedText: true,
          });
        }
        return Promise.resolve(undefined);
      });

      await renderSettingsAndGoToGeneral();

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Voice Modes' }));
        vi.runAllTimers();
      });

      expect(screen.getByText('Translate to English')).toBeInTheDocument();

      const translateSwitch = screen.getByRole('switch', { name: /^Translate to English/i });
      expect(translateSwitch).not.toBeChecked();
    });

    it('should toggle edit selected text', async () => {
      electronAPI.storeGet.mockImplementation((key: string) => {
        if (key === 'voiceInputModes') {
          return Promise.resolve({
            basicVoiceInput: true,
            handsFreeMode: true,
            translateToEnglish: true,
            editSelectedText: false,
          });
        }
        return Promise.resolve(undefined);
      });

      await renderSettingsAndGoToGeneral();

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Voice Modes' }));
        vi.runAllTimers();
      });

      expect(screen.getByText('Edit Selected Text')).toBeInTheDocument();

      const editSwitch = screen.getByRole('switch', { name: /^Edit Selected Text/i });
      expect(editSwitch).not.toBeChecked();
    });
  });

  // ============================================================================
  // LANGUAGE SELECTION TESTS
  // ============================================================================
  describe('Language selection (General tab)', () => {
    beforeEach(() => {
      electronAPI.systemGetStatus.mockResolvedValue({
        audio: { ffmpegAvailable: true, hasAudioDevices: true, deviceCount: 1 },
        transcription: {
          whisperInstalled: true,
          modelAvailable: true,
          hasCloudProvider: false,
          recommendations: [],
        },
      });
      electronAPI.providersListTranscription.mockResolvedValue([]);
      electronAPI.providersListPostProcessing.mockResolvedValue([]);
      electronAPI.aiGetSettings.mockResolvedValue({
        enabled: false,
        options: { removeFillerWords: false, removeRepetition: false, detectSelfCorrection: false },
        showComparison: false,
      });
      electronAPI.storeGet.mockResolvedValue(undefined);
    });

    it('should show language dropdown in General tab', async () => {
      electronAPI.storeGet.mockImplementation((key: string) => {
        if (key === 'language') return Promise.resolve('en-US');
        return Promise.resolve(undefined);
      });

      await renderSettingsAndGoToGeneral();

      await waitFor(() => {
        expect(screen.getByText('Transcription Language')).toBeInTheDocument();
      });

      const languageSelect = screen.getByDisplayValue('English (US)');
      expect(languageSelect).toBeInTheDocument();
    });

    it('should change language selection', async () => {
      electronAPI.storeGet.mockImplementation((key: string) => {
        if (key === 'language') return Promise.resolve('en-US');
        return Promise.resolve(undefined);
      });

      await renderSettingsAndGoToGeneral();

      await waitFor(() => {
        expect(screen.getByDisplayValue('English (US)')).toBeInTheDocument();
      });

      const languageSelect = screen.getByDisplayValue('English (US)');
      fireEvent.change(languageSelect, { target: { value: 'zh-CN' } });

      vi.advanceTimersByTime(400);

      await waitFor(() => {
        expect(electronAPI.storeSet).toHaveBeenCalledWith('language', 'zh-CN');
      });
    });

    it('should toggle auto-punctuation', async () => {
      electronAPI.storeGet.mockImplementation((key: string) => {
        if (key === 'autoPunctuation') return Promise.resolve(true);
        return Promise.resolve(undefined);
      });

      await renderSettingsAndGoToGeneral();

      expect(screen.getByText('Auto Punctuation')).toBeInTheDocument();

      const autoPunctSwitch = screen.getByRole('switch', { name: /^Auto Punctuation/i });
      expect(autoPunctSwitch).toBeChecked();

      fireEvent.click(autoPunctSwitch);

      vi.advanceTimersByTime(400);

      await waitFor(() => {
        expect(electronAPI.storeSet).toHaveBeenCalledWith('autoPunctuation', false);
      });
    });
  });

  // ============================================================================
  // SAVE INDICATOR TESTS
  // ============================================================================
  describe('Save indicator (General tab)', () => {
    beforeEach(() => {
      electronAPI.systemGetStatus.mockResolvedValue({
        audio: { ffmpegAvailable: true, hasAudioDevices: true, deviceCount: 1 },
        transcription: {
          whisperInstalled: true,
          modelAvailable: true,
          hasCloudProvider: false,
          recommendations: [],
        },
      });
      electronAPI.providersListTranscription.mockResolvedValue([]);
      electronAPI.providersListPostProcessing.mockResolvedValue([]);
      electronAPI.aiGetSettings.mockResolvedValue({
        enabled: false,
        options: { removeFillerWords: false, removeRepetition: false, detectSelfCorrection: false },
        showComparison: false,
      });
      electronAPI.storeGet.mockResolvedValue(undefined);
    });

    it('should show saving state', async () => {
      await renderSettingsAndGoToGeneral();

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument();
      });

      const hotkeyInput = screen.getByDisplayValue('CommandOrControl+Shift+D');
      fireEvent.change(hotkeyInput, { target: { value: 'CommandOrControl+Shift+X' } });

      expect(screen.getByText('Saving...')).toBeInTheDocument();
    });

    it('should show saved state', async () => {
      await renderSettingsAndGoToGeneral();

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument();
      });

      const hotkeyInput = screen.getByDisplayValue('CommandOrControl+Shift+D');
      fireEvent.change(hotkeyInput, { target: { value: 'CommandOrControl+Shift+X' } });

      vi.advanceTimersByTime(400);

      await waitFor(() => {
        expect(screen.getByText('Saved')).toBeInTheDocument();
      });
    });
  });

  // ============================================================================
  // SETTINGS PERSISTENCE TESTS
  // ============================================================================
  describe('Settings persistence (General tab)', () => {
    beforeEach(() => {
      electronAPI.systemGetStatus.mockResolvedValue({
        audio: { ffmpegAvailable: true, hasAudioDevices: true, deviceCount: 1 },
        transcription: {
          whisperInstalled: true,
          modelAvailable: true,
          hasCloudProvider: false,
          recommendations: [],
        },
      });
      electronAPI.providersListTranscription.mockResolvedValue([]);
      electronAPI.providersListPostProcessing.mockResolvedValue([]);
      electronAPI.aiGetSettings.mockResolvedValue({
        enabled: false,
        options: { removeFillerWords: false, removeRepetition: false, detectSelfCorrection: false },
        showComparison: false,
      });
    });

    it('should load saved hotkey on mount', async () => {
      electronAPI.storeGet.mockImplementation((key: string) => {
        const settings: Record<string, unknown> = {
          hotkey: 'Alt+Shift+Space',
          language: 'en-US',
          autoPunctuation: true,
          preferredProvider: 'auto',
        };
        return Promise.resolve(settings[key]);
      });

      await renderSettingsAndGoToGeneral();

      await waitFor(() => {
        expect(screen.getByDisplayValue('Alt+Shift+Space')).toBeInTheDocument();
      });
    });

    it('should load saved language on mount', async () => {
      electronAPI.storeGet.mockImplementation((key: string) => {
        const settings: Record<string, unknown> = {
          hotkey: 'CommandOrControl+Shift+D',
          language: 'zh-CN',
          autoPunctuation: true,
          preferredProvider: 'auto',
        };
        return Promise.resolve(settings[key]);
      });

      await renderSettingsAndGoToGeneral();

      await waitFor(() => {
        expect(screen.getByDisplayValue('中文 (简体)')).toBeInTheDocument();
      });
    });

    it('should persist AI settings on change', async () => {
      electronAPI.storeGet.mockResolvedValue(undefined);
      electronAPI.aiGetSettings.mockResolvedValue({
        enabled: true,
        options: { removeFillerWords: true, removeRepetition: true, detectSelfCorrection: true },
        showComparison: true,
      });

      await renderSettingsAndGoToGeneral();

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'AI' }));
        vi.runAllTimers();
      });

      expect(screen.getByText('Enable AI Post-Processing')).toBeInTheDocument();

      const aiSwitch = screen.getByRole('switch', { name: /^Enable AI Post-Processing/i });
      fireEvent.click(aiSwitch);

      await waitFor(() => {
        expect(electronAPI.aiSetSettings).toHaveBeenCalledWith({ enabled: false });
      });
    });
  });
});
