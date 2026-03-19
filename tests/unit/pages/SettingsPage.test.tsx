import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { SettingsPage } from '../../../src/renderer/pages/SettingsPage';
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
        ffmpegRequired: 'FFmpeg is required for audio processing',
      },
    },
  }),
}));

const { electronAPI, assignToWindow, resetElectronAPIMock } = createElectronAPIMock();

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
    it('should render initial loading state for system status', () => {
      render(<SettingsPage />);

      expect(screen.getByText('Loading system status...')).toBeInTheDocument();
    });

    it('should render with loaded settings', async () => {
      // Mock settings data
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

      render(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument();
      });

      // Check general settings are rendered
      expect(screen.getByText('General')).toBeInTheDocument();
      expect(screen.getByDisplayValue('CommandOrControl+Shift+D')).toBeInTheDocument();
    });

    it('should display provider list', async () => {
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
      electronAPI.providersListPostProcessing.mockResolvedValue([]);
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

      render(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByText('OpenAI')).toBeInTheDocument();
      });

      expect(screen.getByText('Cloud transcription via OpenAI API')).toBeInTheDocument();
      expect(screen.getByText('Groq')).toBeInTheDocument();
    });

    it('should display system status', async () => {
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

      render(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByText('Ready to transcribe')).toBeInTheDocument();
      });

      expect(screen.getByText('FFmpeg')).toBeInTheDocument();
      expect(screen.getByText('Microphone')).toBeInTheDocument();
      expect(screen.getByText('Whisper')).toBeInTheDocument();
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

      render(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByDisplayValue('CommandOrControl+Shift+Space')).toBeInTheDocument();
      });
    });

    it('should change hotkey', async () => {
      render(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument();
      });

      const hotkeyInput = screen.getByDisplayValue('CommandOrControl+Shift+D');
      fireEvent.change(hotkeyInput, { target: { value: 'CommandOrControl+Alt+Space' } });

      expect(hotkeyInput).toHaveValue('CommandOrControl+Alt+Space');
    });

    it('should save on hotkey change', async () => {
      render(<SettingsPage />);

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
  // PROVIDER CONFIGURATION TESTS
  // ============================================================================
  describe('Provider configuration', () => {
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
      electronAPI.providersListTranscription.mockResolvedValue([mockTranscriptionProvider]);
      electronAPI.providersListPostProcessing.mockResolvedValue([]);
    });

    it('should enable/disable provider toggle', async () => {
      render(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByText('OpenAI')).toBeInTheDocument();
      });

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
      electronAPI.storeGet.mockImplementation((key: string) => {
        if (key === 'providers') {
          return Promise.resolve([
            { id: 'openai', enabled: true, enabledForTranscription: true, apiKey: 'sk-test123' },
          ]);
        }
        return Promise.resolve(undefined);
      });

      render(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByText('OpenAI')).toBeInTheDocument();
      });

      // When enabled, API key input should be visible
      await waitFor(() => {
        const apiKeyInput = screen.getByPlaceholderText('OpenAI API key');
        expect(apiKeyInput).toHaveAttribute('type', 'password');
        expect(apiKeyInput).toHaveValue('sk-test123');
      });
    });

    it('should configure base URL', async () => {
      electronAPI.storeGet.mockImplementation((key: string) => {
        if (key === 'providers') {
          return Promise.resolve([
            { id: 'openai', enabled: true, enabledForTranscription: true, apiKey: 'sk-test' },
          ]);
        }
        return Promise.resolve(undefined);
      });

      render(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByText('OpenAI')).toBeInTheDocument();
      });

      await waitFor(() => {
        const baseUrlInput = screen.getByDisplayValue('https://api.openai.com/v1');
        expect(baseUrlInput).toBeInTheDocument();
      });

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

    it('should configure model selection', async () => {
      const providerWithMultipleModels = {
        ...mockTranscriptionProvider,
        supportedModels: ['whisper-1', 'whisper-large-v3'],
      };

      electronAPI.providersListTranscription.mockResolvedValue([providerWithMultipleModels]);
      electronAPI.storeGet.mockImplementation((key: string) => {
        if (key === 'providers') {
          return Promise.resolve([
            { id: 'openai', enabled: true, enabledForTranscription: true, apiKey: 'sk-test' },
          ]);
        }
        return Promise.resolve(undefined);
      });

      render(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByText('OpenAI')).toBeInTheDocument();
      });

      await waitFor(() => {
        // Model label is present but not associated via htmlFor, so find by text then check for select
        const modelLabel = screen.getByText('Model');
        expect(modelLabel).toBeInTheDocument();
        // The select should be in the same parent container
        const container = modelLabel.closest('div');
        const select = container?.querySelector('select');
        expect(select).toBeInTheDocument();
      });
    });

    it('should show test connection button', async () => {
      electronAPI.storeGet.mockImplementation((key: string) => {
        if (key === 'providers') {
          return Promise.resolve([
            { id: 'openai', enabled: true, enabledForTranscription: true, apiKey: 'sk-test' },
          ]);
        }
        return Promise.resolve(undefined);
      });

      render(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByText('Test')).toBeInTheDocument();
      });
    });

    it('should show test success feedback', async () => {
      electronAPI.providersTest.mockResolvedValue({ success: true });
      electronAPI.storeGet.mockImplementation((key: string) => {
        if (key === 'providers') {
          return Promise.resolve([
            { id: 'openai', enabled: true, enabledForTranscription: true, apiKey: 'sk-test' },
          ]);
        }
        return Promise.resolve(undefined);
      });

      render(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByText('Test')).toBeInTheDocument();
      });

      const testButton = screen.getByText('Test');
      fireEvent.click(testButton);

      await waitFor(() => {
        expect(screen.getByText('Connected')).toBeInTheDocument();
      });
    });

    it('should show test error feedback', async () => {
      electronAPI.providersTest.mockResolvedValue({ success: false, error: 'Invalid API key' });
      electronAPI.storeGet.mockImplementation((key: string) => {
        if (key === 'providers') {
          return Promise.resolve([
            { id: 'openai', enabled: true, enabledForTranscription: true, apiKey: 'sk-invalid' },
          ]);
        }
        return Promise.resolve(undefined);
      });

      render(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByText('Test')).toBeInTheDocument();
      });

      const testButton = screen.getByText('Test');
      fireEvent.click(testButton);

      await waitFor(() => {
        expect(screen.getByText('Invalid API key')).toBeInTheDocument();
      });
    });
  });

  // ============================================================================
  // AI SETTINGS TESTS
  // ============================================================================
  describe('AI settings', () => {
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

    it('should toggle AI post-processing', async () => {
      electronAPI.aiGetSettings.mockResolvedValue({
        enabled: false,
        options: { removeFillerWords: false, removeRepetition: false, detectSelfCorrection: false },
        showComparison: false,
      });

      render(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByText('AI Post-Processing')).toBeInTheDocument();
      });

      const aiSection = screen.getByText('Enable AI Post-Processing').closest('label');
      const enableCheckbox = aiSection?.querySelector('input[type="checkbox"]');
      fireEvent.click(enableCheckbox!);

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

      render(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByText('Processing Options')).toBeInTheDocument();
      });

      // Find checkboxes by navigating from label text to input
      const fillerWordsSection = screen.getByText('Remove filler words (um, uh, like)').closest('label');
      const repetitionSection = screen.getByText('Remove repetition').closest('label');
      const correctionSection = screen.getByText('Detect self-correction').closest('label');
      
      expect(fillerWordsSection?.querySelector('input')).toBeChecked();
      expect(repetitionSection?.querySelector('input')).toBeChecked();
      expect(correctionSection?.querySelector('input')).toBeChecked();

      // Toggle filler words off
      const fillerWordsCheckbox = fillerWordsSection?.querySelector('input');
      fireEvent.click(fillerWordsCheckbox!);

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

      render(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByText('Show before/after comparison')).toBeInTheDocument();
      });

      const comparisonSection = screen.getByText('Show before/after comparison').closest('label');
      expect(comparisonSection?.querySelector('input')).toBeChecked();
    });

    it('should show AI provider status when AI is enabled', async () => {
      electronAPI.aiGetSettings.mockResolvedValue({
        enabled: true,
        options: { removeFillerWords: false, removeRepetition: false, detectSelfCorrection: false },
        showComparison: false,
      });

      // Mock no AI provider configured
      electronAPI.storeGet.mockImplementation((key: string) => {
        if (key === 'providers') return Promise.resolve([]);
        return Promise.resolve(undefined);
      });

      render(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByText('Configure an AI provider above to enable post-processing')).toBeInTheDocument();
      });
    });
  });

  // ============================================================================
  // VOICE INPUT MODES TESTS
  // ============================================================================
  describe('Voice input modes', () => {
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

    it('should toggle basic voice input', async () => {
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

      render(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByText('Basic Voice Input')).toBeInTheDocument();
      });

      // Find the checkbox for basic voice input
      const basicVoiceInputSection = screen.getByText('Basic Voice Input').closest('label');
      const checkbox = basicVoiceInputSection?.querySelector('input[type="checkbox"]');
      expect(checkbox).toBeChecked();

      fireEvent.click(checkbox!);

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

      render(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByText('Hands-free Mode')).toBeInTheDocument();
      });

      const handsFreeSection = screen.getByText('Hands-free Mode').closest('label');
      const checkbox = handsFreeSection?.querySelector('input[type="checkbox"]');
      expect(checkbox).not.toBeChecked();
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

      render(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByText('Translate to English')).toBeInTheDocument();
      });

      // Wait for loadSettings() to complete so voiceInputModes state reflects the mock
      await waitFor(() => {
        const translateSection = screen.getByText('Translate to English').closest('label');
        const checkbox = translateSection?.querySelector('input[type="checkbox"]');
        expect(checkbox).not.toBeChecked();
      });
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

      render(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByText('Edit Selected Text')).toBeInTheDocument();
      });

      // Wait for state to load from mock
      await waitFor(() => {
        const editSection = screen.getByText('Edit Selected Text').closest('label');
        const checkbox = editSection?.querySelector('input[type="checkbox"]');
        expect(checkbox).not.toBeChecked();
      });
    });
  });

  // ============================================================================
  // LANGUAGE SELECTION TESTS
  // ============================================================================
  describe('Language selection', () => {
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

    it('should show language dropdown', async () => {
      electronAPI.storeGet.mockImplementation((key: string) => {
        if (key === 'language') return Promise.resolve('en-US');
        return Promise.resolve(undefined);
      });

      render(<SettingsPage />);

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

      render(<SettingsPage />);

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

      render(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByText('Auto Punctuation')).toBeInTheDocument();
      });

      const autoPunctSection = screen.getByText('Auto Punctuation').closest('label');
      const punctuationCheckbox = autoPunctSection?.querySelector('input[type="checkbox"]');
      expect(punctuationCheckbox).toBeChecked();

      fireEvent.click(punctuationCheckbox);

      vi.advanceTimersByTime(400);

      await waitFor(() => {
        expect(electronAPI.storeSet).toHaveBeenCalledWith('autoPunctuation', false);
      });
    });
  });

  // ============================================================================
  // SAVE INDICATOR TESTS
  // ============================================================================
  describe('Save indicator', () => {
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
      render(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument();
      });

      // Trigger a save by changing hotkey
      const hotkeyInput = screen.getByDisplayValue('CommandOrControl+Shift+D');
      fireEvent.change(hotkeyInput, { target: { value: 'CommandOrControl+Shift+X' } });

      // Should show saving indicator briefly
      expect(screen.getByText('Saving...')).toBeInTheDocument();
    });

    it('should show saved state', async () => {
      render(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument();
      });

      // Trigger a save
      const hotkeyInput = screen.getByDisplayValue('CommandOrControl+Shift+D');
      fireEvent.change(hotkeyInput, { target: { value: 'CommandOrControl+Shift+X' } });

      // Advance past saving to saved state
      vi.advanceTimersByTime(400);

      await waitFor(() => {
        expect(screen.getByText('Saved')).toBeInTheDocument();
      });
    });

    it('should return to idle state after save completes', async () => {
      const { rerender } = render(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument();
      });

      // Trigger a save
      const hotkeyInput = screen.getByDisplayValue('CommandOrControl+Shift+D');
      fireEvent.change(hotkeyInput, { target: { value: 'CommandOrControl+Shift+X' } });

      // First show saving state
      expect(screen.getByText('Saving...')).toBeInTheDocument();

      // Advance timers to trigger state transitions
      vi.advanceTimersByTime(2000);

      // Rerender to flush pending state updates
      rerender(<SettingsPage />);

      // After complete cycle, the save status indicator should be gone
      // (the indicator only shows when saveStatus !== 'idle')
      const saveIndicator = screen.queryByText(/Saving...|Saved/);
      expect(saveIndicator).toBeNull();
    });
  });

  // ============================================================================
  // SETTINGS PERSISTENCE TESTS
  // ============================================================================
  describe('Settings persistence', () => {
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

      render(<SettingsPage />);

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

      render(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByDisplayValue('中文 (简体) - Chinese')).toBeInTheDocument();
      });
    });

    it('should save preferred provider on change', async () => {
      electronAPI.storeGet.mockImplementation((key: string) => {
        const settings: Record<string, unknown> = {
          hotkey: 'CommandOrControl+Shift+D',
          language: 'en-US',
          autoPunctuation: true,
          preferredProvider: 'auto',
        };
        return Promise.resolve(settings[key]);
      });

      render(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByDisplayValue('Auto (Local first, fallback to Cloud)')).toBeInTheDocument();
      });

      const providerSelect = screen.getByDisplayValue('Auto (Local first, fallback to Cloud)');
      fireEvent.change(providerSelect, { target: { value: 'cloud' } });

      vi.advanceTimersByTime(400);

      await waitFor(() => {
        expect(electronAPI.storeSet).toHaveBeenCalledWith('preferredProvider', 'cloud');
      });
    });

    it('should persist AI settings on change', async () => {
      electronAPI.storeGet.mockResolvedValue(undefined);
      electronAPI.aiGetSettings.mockResolvedValue({
        enabled: true,
        options: { removeFillerWords: true, removeRepetition: true, detectSelfCorrection: true },
        showComparison: true,
      });

      render(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByText('Enable AI Post-Processing')).toBeInTheDocument();
      });

      const aiSection = screen.getByText('Enable AI Post-Processing').closest('label');
      const aiCheckbox = aiSection?.querySelector('input[type="checkbox"]');
      fireEvent.click(aiCheckbox!);

      await waitFor(() => {
        expect(electronAPI.aiSetSettings).toHaveBeenCalledWith({ enabled: false });
      });
    });
  });
});
