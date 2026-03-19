import { useState, useEffect } from 'react';
import { Keyboard, Globe, Zap, Check, CheckCircle, AlertCircle, Terminal, ExternalLink, Mic } from 'lucide-react';
import { AudioDeviceSelector } from '../components/AudioDeviceSelector';
import { useI18n } from '../i18n';

// Module-level version display (updated via store init in main process)
let _versionDisplay = '...';

interface Provider {
  id: string;
  name: string;
  description: string;
  requireApiKey: boolean;
  defaultBaseUrl?: string;
  defaultModel?: string;
  supportedModels: string[];
  category?: 'transcription' | 'post-processing';
}

interface ProviderConfig {
  id: string;
  enabled: boolean;
  enabledForTranscription?: boolean;
  enabledForPostProcessing?: boolean;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  credentials?: Record<string, string>;
  hasKeyInKeychain?: boolean;
}

interface SystemStatus {
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
}

export function SettingsPage() {
  const { t } = useI18n();
  const [hotkey, setHotkey] = useState('CommandOrControl+Shift+D');
  const [language, setLanguage] = useState('en-US');
  const [autoPunctuation, setAutoPunctuation] = useState(true);
  const [preferredProvider, setPreferredProvider] = useState<'local' | 'cloud' | 'auto'>('auto');
  const [fallbackEnabled, setFallbackEnabled] = useState(true);
  const [transcriptionProviders, setTranscriptionProviders] = useState<Provider[]>([]);
  const [postProcessingProviders, setPostProcessingProviders] = useState<Provider[]>([]);
  const [providerConfigs, setProviderConfigs] = useState<Record<string, ProviderConfig>>({});
  const [testingProvider, setTestingProvider] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ id: string; success: boolean; error?: string } | null>(null);
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [aiSettings, setAiSettingsState] = useState({
    enabled: false,
    options: {
      removeFillerWords: true,
      removeRepetition: true,
      detectSelfCorrection: true,
      restorePunctuation: true,
    },
    showComparison: true,
  });
  const [aiAvailable, setAiAvailable] = useState(false);
  const [voiceInputModes, setVoiceInputModes] = useState({
    basicVoiceInput: true,
    handsFreeMode: true,
    translateToEnglish: true,
    editSelectedText: true,
  });
  const [translatePair, setTranslatePair] = useState('zh→en');
  const [localModels, setLocalModels] = useState<Array<{ name: string; path: string; size: number; exists: boolean }>>([]);
  const [deletingModel, setDeletingModel] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [audioDevices, setAudioDevices] = useState<Array<{ index: string; name: string }>>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>('0');
  const [audioDevicesLoading, setAudioDevicesLoading] = useState(false);

  const showSaveIndicator = () => {
    setSaveStatus('saving');
    setTimeout(() => setSaveStatus('saved'), 300);
    setTimeout(() => setSaveStatus('idle'), 1500);
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  useEffect(() => {
    loadSettings();
    loadProviders();
    loadSystemStatus();
    loadAudioDevices();
    window.electronAPI.storeGet('appVersion').then((v: any) => { if (v) _versionDisplay = v as string; });
    const unsub = window.electronAPI.onUpdateState((s: any) => {
      if (s.version) _versionDisplay = s.version;
    });
    return unsub;
  }, []);

  const loadSettings = async () => {
    const [savedHotkey, savedLanguage, savedPunctuation, savedPreferredProvider, savedAiSettings, savedVoiceModes, savedFallbackSettings, savedTranslateSettings] = await Promise.all([
      window.electronAPI.storeGet('hotkey'),
      window.electronAPI.storeGet('language'),
      window.electronAPI.storeGet('autoPunctuation'),
      window.electronAPI.storeGet('preferredProvider'),
      window.electronAPI.aiGetSettings(),
      window.electronAPI.storeGet('voiceInputModes'),
      window.electronAPI.storeGet('fallbackSettings'),
      window.electronAPI.storeGet('translateSettings'),
    ]);

    if (savedHotkey) setHotkey(savedHotkey as string);
    if (savedLanguage) setLanguage(savedLanguage as string);
    if (savedPunctuation !== undefined) setAutoPunctuation(savedPunctuation as boolean);
    if (savedPreferredProvider) setPreferredProvider(savedPreferredProvider as 'local' | 'cloud' | 'auto');
    if (savedAiSettings) {
      setAiSettingsState(savedAiSettings);
      checkAiAvailability(savedAiSettings);
    }
    if (savedVoiceModes) {
      setVoiceInputModes(savedVoiceModes as typeof voiceInputModes);
    }
    if (savedFallbackSettings) {
      setFallbackEnabled((savedFallbackSettings as { enabled: boolean }).enabled ?? true);
    }
    if (savedTranslateSettings) {
      const ts = savedTranslateSettings as { sourceLang: string; targetLang: string };
      setTranslatePair(`${ts.sourceLang}→${ts.targetLang}`);
    }

    // Load local models
    try {
      const models = await window.electronAPI.modelsList();
      setLocalModels(models);
    } catch {}
  };

  const checkAiAvailability = async (settings?: typeof aiSettings) => {
    const aiSet = settings || aiSettings;
    const providers = await window.electronAPI.storeGet('providers') as Array<{ id: string; enabled?: boolean; enabledForPostProcessing?: boolean; apiKey?: string }>;
    const hasAiProvider = providers?.some(p => {
      const isEnabled = p.enabledForPostProcessing ?? p.enabled;
      return isEnabled && p.apiKey && ['openai', 'groq', 'anthropic', 'deepseek', 'zhipu', 'minimax', 'moonshot'].includes(p.id);
    });
    setAiAvailable(hasAiProvider);
  };

  const updateAiSettings = async (updates: Partial<typeof aiSettings>) => {
    const newSettings = { ...aiSettings, ...updates };
    setAiSettingsState(newSettings);
    await window.electronAPI.aiSetSettings(updates);
  };

  const updateVoiceInputMode = async (mode: keyof typeof voiceInputModes, enabled: boolean) => {
    const newModes = { ...voiceInputModes, [mode]: enabled };
    setVoiceInputModes(newModes);
    showSaveIndicator();
    await window.electronAPI.storeSet('voiceInputModes', newModes);
  };

  const loadProviders = async () => {
    const [transcriptionList, postProcessingList, configs] = await Promise.all([
      window.electronAPI.providersListTranscription(),
      window.electronAPI.providersListPostProcessing(),
      window.electronAPI.storeGet('providers'),
    ]);
    
    setTranscriptionProviders(transcriptionList as Provider[]);
    setPostProcessingProviders(postProcessingList as Provider[]);
    
    const configMap: Record<string, ProviderConfig> = {};
    (configs as ProviderConfig[] || []).forEach((c) => {
      configMap[c.id] = c;
    });
    setProviderConfigs(configMap);
  };

  const loadSystemStatus = async () => {
    try {
      const status = await window.electronAPI.systemGetStatus();
      setSystemStatus(status);
    } catch (error) {
      console.error('Failed to load system status:', error);
    }
  };

  const loadAudioDevices = async () => {
    setAudioDevicesLoading(true);
    try {
      const devices = await window.electronAPI.audioGetDevices();
      const selected = await window.electronAPI.audioGetSelectedDevice();
      setAudioDevices(devices);
      if (selected) {
        setSelectedDevice(selected.index);
      }
    } catch (error) {
      console.error('Failed to load audio devices:', error);
    } finally {
      setAudioDevicesLoading(false);
    }
  };

  const handleDeviceSelect = async (deviceIndex: string) => {
    setSelectedDevice(deviceIndex);
    showSaveIndicator();
    try {
      await window.electronAPI.audioSetSelectedDevice({ 
        index: deviceIndex, 
        name: audioDevices.find(d => d.index === deviceIndex)?.name || '',
        selectedAt: Date.now()
      });
    } catch (error) {
      console.error('Failed to select device:', error);
    }
  };

  const saveHotkey = async (value: string) => {
    setHotkey(value);
    showSaveIndicator();
    await window.electronAPI.storeSet('hotkey', value);
  };

  const saveLanguage = async (value: string) => {
    setLanguage(value);
    showSaveIndicator();
    await window.electronAPI.storeSet('language', value);
    const langCode = value.split('-')[0];
    await window.electronAPI.storeSet('transcriptionLanguage', langCode);
  };

  const saveAutoPunctuation = async (value: boolean) => {
    setAutoPunctuation(value);
    showSaveIndicator();
    await window.electronAPI.storeSet('autoPunctuation', value);
  };

  const savePreferredProvider = async (value: 'local' | 'cloud' | 'auto') => {
    setPreferredProvider(value);
    showSaveIndicator();
    await window.electronAPI.storeSet('preferredProvider', value);
    setTimeout(loadSystemStatus, 100);
  };

  const saveFallbackEnabled = async (enabled: boolean) => {
    setFallbackEnabled(enabled);
    showSaveIndicator();
    const currentSettings = await window.electronAPI.storeGet('fallbackSettings') as { enabled: boolean; providerOrder: string[]; maxAttempts: number };
    await window.electronAPI.storeSet('fallbackSettings', {
      ...currentSettings,
      enabled,
    });
  };

  const updateProviderConfig = async (providerId: string, updates: Partial<ProviderConfig>) => {
    const current = providerConfigs[providerId] || { id: providerId, enabled: false };
    const updated = { ...current, ...updates };

    showSaveIndicator();
    await window.electronAPI.providersSetConfig(providerId, updated);

    setProviderConfigs(prev => ({
      ...prev,
      [providerId]: updated,
    }));

    if (updates.enabled !== undefined || updates.apiKey !== undefined) {
      setTimeout(() => {
        loadSystemStatus();
    loadAudioDevices();
        checkAiAvailability();
      }, 100);
    }
  };

  const testProvider = async (providerId: string) => {
    setTestingProvider(providerId);
    setTestResult(null);
    
    const result = await window.electronAPI.providersTest(providerId);
    
    setTestingProvider(null);
    setTestResult({ id: providerId, ...result });
  };

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: '32px' }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '32px',
      }}>
        <h1 style={{
          fontSize: '24px',
          fontWeight: 600,
          color: '#fff',
          margin: 0,
        }}>
          {t.settings.title}
        </h1>
        {saveStatus !== 'idle' && (
          <span style={{
            fontSize: '12px',
            color: saveStatus === 'saving' ? '#818cf8' : '#22c55e',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}>
            {saveStatus === 'saving' ? (
              <>Saving...</>
            ) : (
              <><CheckCircle size={12} /> Saved</>
            )}
          </span>
        )}
      </div>

      {/* System Status Section */}
      <section style={{ marginBottom: '40px' }}>
        <h2 style={{
          fontSize: '14px',
          fontWeight: 600,
          color: '#666',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          marginBottom: '20px',
        }}
        >
          {t.status.title}
        </h2>

        <div style={{
          background: '#161616',
          border: '1px solid #222',
          borderRadius: '12px',
          padding: '24px',
        }}
        >
          {systemStatus ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Dependencies */}
              <div>
                <h3 style={{ fontSize: '13px', color: '#888', marginBottom: '12px' }}>{t.status.dependencies}</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <StatusRow
                    label={t.status.ffmpeg}
                    status={systemStatus.audio.ffmpegAvailable ? 'ready' : 'missing'}
                    description={systemStatus.audio.ffmpegAvailable ? t.status.installed : t.status.ffmpegRequired}
                  />
                  <StatusRow
                    label={t.status.microphone}
                    status={systemStatus.audio.hasAudioDevices ? 'ready' : 'missing'}
                    description={`${systemStatus.audio.deviceCount} ${t.status.devices}`}
                  />
                  <StatusRow
                    label={t.status.whisper}
                    status={systemStatus.transcription.whisperInstalled ? 'ready' : 'missing'}
                    description={systemStatus.transcription.whisperInstalled ? t.status.installed : t.status.notFound}
                  />
                  <StatusRow
                    label={t.status.modelFile}
                    status={systemStatus.transcription.modelAvailable ? 'ready' : 'missing'}
                    description={systemStatus.transcription.modelAvailable ? t.status.found : t.status.notFound}
                  />
                </div>
                
                {!systemStatus.audio.ffmpegAvailable && (
                  <SetupHint
                    title={`${t.status.ffmpeg} ${t.status.notFound}`}
                    command="brew install ffmpeg"
                    description={t.status.ffmpegRequired}
                  />
                )}
                
                {!systemStatus.transcription.whisperInstalled && !systemStatus.transcription.hasCloudProvider && (
                  <SetupHint
                    title={`${t.status.whisper} ${t.status.notFound}`}
                    command="brew install whisper.cpp"
                    description={t.status.noProviderDescription}
                  />
                )}
                
                {!systemStatus.transcription.modelAvailable && systemStatus.transcription.whisperInstalled && (
                  <SetupHint
                    title={`${t.status.model} ${t.status.notFound}`}
                    command="mkdir -p ~/Library/Application\ Support/OpenType/models && curl -L -o ~/Library/Application\\ Support/OpenType/models/ggml-base.bin https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin"
                    description="Download a Whisper model to enable local transcription. Base model (~74MB) recommended for most users."
                  />
                )}
              </div>

              {/* Active Provider */}
              {systemStatus.transcription.activeProvider && (
                <div style={{
                  padding: '12px 16px',
                  background: 'rgba(34, 197, 94, 0.1)',
                  borderRadius: '8px',
                  border: '1px solid rgba(34, 197, 94, 0.2)',
                }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Check size={16} color="#22c55e" />
                    <span style={{ color: '#22c55e', fontWeight: 500 }}>
                      {t.status.readyToTranscribe}
                    </span>
                    <span style={{ color: '#666', marginLeft: 'auto', fontSize: '13px' }}>
                      {t.status.using} {systemStatus.transcription.activeProvider}
                    </span>
                  </div>
                </div>
              )}
              
              {!systemStatus.transcription.activeProvider && (
                <div style={{
                  padding: '12px 16px',
                  background: 'rgba(239, 68, 68, 0.1)',
                  borderRadius: '8px',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <AlertCircle size={16} color="#ef4444" />
                    <span style={{ color: '#ef4444', fontWeight: 500 }}>
                      {t.status.noProviderConfigured}
                    </span>
                  </div>
                  <p style={{ 
                    margin: '8px 0 0 0', 
                    fontSize: '12px', 
                    color: '#888',
                    paddingLeft: '24px'
                  }}>
                    {t.status.noProviderDescription}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div style={{ color: '#666', textAlign: 'center', padding: '20px' }}>
              {t.status.loading}
            </div>
          )}
        </div>
      </section>

      {/* Audio Device Selection Section */}
      <section style={{ marginBottom: '40px' }}>
        <h2 style={{
          fontSize: '14px',
          fontWeight: 600,
          color: '#666',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          marginBottom: '20px',
        }}>
          Audio Input
        </h2>

        <div style={{
          background: '#161616',
          border: '1px solid #222',
          borderRadius: '12px',
          padding: '24px',
        }}>
          <div style={{ marginBottom: '24px' }}>
            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '14px',
              fontWeight: 500,
              color: '#ccc',
              marginBottom: '8px',
            }}>
              <Mic size={16} /> Microphone Device
            </label>
            
            {audioDevicesLoading ? (
              <div style={{ color: '#666', padding: '12px' }}>Loading devices...</div>
            ) : audioDevices.length === 0 ? (
              <div style={{ color: '#ef4444', padding: '12px' }}>
                No audio devices found. Please check your microphone connection.
              </div>
            ) : (
              <select
                value={selectedDevice || ''}
                onChange={(e) => handleDeviceSelect(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  background: '#0f0f0f',
                  border: '1px solid #2a2a2a',
                  borderRadius: '8px',
                  color: '#fff',
                  fontSize: '14px',
                }}
              >
                {audioDevices.map((device) => (
                  <option key={device.index} value={device.index}>
                    {device.name} {device.index === '0' && '(Default)'}
                  </option>
                ))}
              </select>
            )}

            <p style={{
              fontSize: '12px',
              color: '#555',
              marginTop: '8px',
            }}>
              Select your preferred microphone for voice input. Changes take effect immediately.
            </p>
          </div>
        </div>
      </section>

      {/* General Section */}
      <section style={{ marginBottom: '40px' }}>
        <h2 style={{
          fontSize: '14px',
          fontWeight: 600,
          color: '#666',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          marginBottom: '20px',
        }}
        >
          {t.settings.general}
        </h2>

        <div style={{
          background: '#161616',
          border: '1px solid #222',
          borderRadius: '12px',
          padding: '24px',
        }}>
          {/* Hotkey Setting */}
          <div style={{ marginBottom: '24px' }}>
            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '14px',
              fontWeight: 500,
              color: '#ccc',
              marginBottom: '8px',
            }}
            >
              <Keyboard size={16} /> {t.settings.hotkey}
            </label>
            <input
              type="text"
              value={hotkey}
              onChange={(e) => saveHotkey(e.target.value)}
              style={{
                width: '100%',
                padding: '12px 16px',
                background: '#0f0f0f',
                border: '1px solid #2a2a2a',
                borderRadius: '8px',
                color: '#fff',
                fontSize: '14px',
              }}
            />
            <p style={{
              fontSize: '12px',
              color: '#555',
              marginTop: '6px',
            }}
            >
              {t.settings.hotkeyDescription}
            </p>
          </div>

          {/* Transcription Language Setting */}
          <div style={{ marginBottom: '24px' }}>
            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '14px',
              fontWeight: 500,
              color: '#ccc',
              marginBottom: '8px',
            }}
            >
              <Globe size={16} /> {t.settings.transcriptionLanguage}
            </label>
            <select
              value={language}
              onChange={(e) => saveLanguage(e.target.value)}
              style={{
                width: '100%',
                padding: '12px 16px',
                background: '#0f0f0f',
                border: '1px solid #2a2a2a',
                borderRadius: '8px',
                color: '#fff',
                fontSize: '14px',
              }}
            >
              <option value="en-US">English (US)</option>
              <option value="en-GB">English (UK)</option>
              <option value="zh-CN">中文 (简体) - Chinese</option>
              <option value="zh-TW">中文 (繁體) - Chinese (Traditional)</option>
              <option value="ja-JP">日本語 - Japanese</option>
              <option value="ko-KR">한국어 - Korean</option>
              <option value="es-ES">Español - Spanish</option>
              <option value="fr-FR">Français - French</option>
              <option value="de-DE">Deutsch - German</option>
            </select>
            <p style={{
              fontSize: '12px',
              color: '#555',
              marginTop: '6px',
            }}
            >
              {t.settings.transcriptionLanguageDescription}. {t.settings.using}: {language.split('-')[0]}
            </p>
          </div>

          {/* Auto Punctuation */}
          <div style={{ marginBottom: '24px' }}>
            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              cursor: 'pointer',
            }}
            >
              <input
                type="checkbox"
                checked={autoPunctuation}
                onChange={(e) => saveAutoPunctuation(e.target.checked)}
                style={{
                  width: '18px',
                  height: '18px',
                  accentColor: '#6366f1',
                }}
              />
              <div>
                <p style={{
                  fontSize: '14px',
                  fontWeight: 500,
                  color: '#ccc',
                  margin: 0,
                }}
                >
                  {t.settings.autoPunctuation}
                </p>
                <p style={{
                  fontSize: '12px',
                  color: '#555',
                  margin: 0,
                }}
                >
                  {t.settings.autoPunctuationDescription}
                </p>
              </div>
            </label>
          </div>

          {/* Preferred Provider */}
          <div>
            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '14px',
              fontWeight: 500,
              color: '#ccc',
              marginBottom: '8px',
            }}
            >
              <Zap size={16} /> {t.settings.preferredProvider}
            </label>
            <select
              value={preferredProvider}
              onChange={(e) => savePreferredProvider(e.target.value as 'local' | 'cloud' | 'auto')}
              style={{
                width: '100%',
                padding: '12px 16px',
                background: '#0f0f0f',
                border: '1px solid #2a2a2a',
                borderRadius: '8px',
                color: '#fff',
                fontSize: '14px',
              }}
            >
              <option value="auto">{t.settings.preferredProviderAuto}</option>
              <option value="local">{t.settings.preferredProviderLocal}</option>
              <option value="cloud">{t.settings.preferredProviderCloud}</option>
            </select>
            <p style={{
              fontSize: '12px',
              color: '#555',
              marginTop: '6px',
            }}
            >
              {t.settings.preferredProviderDescription}
            </p>
          </div>

          {/* Fallback Settings */}
          <div style={{ marginTop: '16px' }}>
            <label style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
            }}
            >
              <div>
                <p style={{
                  fontSize: '14px',
                  fontWeight: 500,
                  color: '#ccc',
                  margin: '0 0 4px 0',
                }}
                >
                  Enable Provider Fallback
                </p>
                <p style={{
                  fontSize: '12px',
                  color: '#666',
                  margin: 0,
                }}
                >
                  Automatically try alternative providers if the primary one fails
                </p>
              </div>
              <input
                type="checkbox"
                checked={fallbackEnabled}
                onChange={(e) => saveFallbackEnabled(e.target.checked)}
                style={{
                  width: '18px',
                  height: '18px',
                  accentColor: '#6366f1',
                }}
              />
            </label>
          </div>

          {/* Audio Input Device */}
          <div>
            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '14px',
              fontWeight: 500,
              color: '#ccc',
              marginBottom: '8px',
            }}>
              <Mic size={16} /> Audio Input Device
            </label>
            <AudioDeviceSelector onSave={showSaveIndicator} />
            <p style={{
              fontSize: '12px',
              color: '#555',
              marginTop: '6px',
            }}>
              Select which microphone to use for recording
            </p>
          </div>
        </div>
      </section>

      <section>
        <h2 style={{
          fontSize: '14px',
          fontWeight: 600,
          color: '#666',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          marginBottom: '20px',
        }}>
          {t.settings.transcriptionProviders || 'Transcription Providers'}
        </h2>
        <p style={{
          fontSize: '13px',
          color: '#888',
          marginBottom: '16px',
        }}>
          {t.settings.transcriptionProvidersDescription || 'Configure speech-to-text services for audio transcription'}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {transcriptionProviders.map((provider) => {
            const config = providerConfigs[provider.id] || { enabled: false };
            const isTesting = testingProvider === provider.id;
            const testRes = testResult?.id === provider.id ? testResult : null;

            return (
              <div
                key={provider.id}
                style={{
                  background: '#161616',
                  border: '1px solid #222',
                  borderRadius: '12px',
                  padding: '20px',
                }}
              >
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: (config.enabledForTranscription ?? config.enabled) ? '16px' : 0,
                }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <h3 style={{
                        fontSize: '16px',
                        fontWeight: 600,
                        color: '#fff',
                        margin: 0,
                      }}
                      >
                        {provider.name}
                      </h3>
                      {/* Provider Status Indicator */}
                      {config.hasKeyInKeychain && (
                        <span style={{
                          fontSize: '11px',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          background: testRes?.success ? 'rgba(34, 197, 94, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                          color: testRes?.success ? '#22c55e' : '#f59e0b',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}>
                          {testRes?.success ? <CheckCircle size={10} /> : <AlertCircle size={10} />}
                          {testRes?.success ? 'Connected' : 'Configured'}
                        </span>
                      )}
                    </div>
                    <p style={{
                      fontSize: '13px',
                      color: '#666',
                      margin: 0,
                    }}
                    >
                      {provider.description}
                    </p>
                  </div>

                  <button
                    onClick={() => updateProviderConfig(provider.id, { enabledForTranscription: !(config.enabledForTranscription ?? config.enabled) })}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '6px',
                      border: (config.enabledForTranscription ?? config.enabled) ? '1px solid #22c55e' : '1px solid #333',
                      background: (config.enabledForTranscription ?? config.enabled) ? 'rgba(34, 197, 94, 0.1)' : '#222',
                      color: (config.enabledForTranscription ?? config.enabled) ? '#22c55e' : '#666',
                      fontSize: '13px',
                      fontWeight: 500,
                      cursor: 'pointer',
                    }}
                  >
                    {(config.enabledForTranscription ?? config.enabled) ? t.settings.enabled : 'Disabled'}
                  </button>
                </div>

                {(config.enabledForTranscription ?? config.enabled) && (
                  <div style={{
                    paddingTop: '16px',
                    borderTop: '1px solid #222',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                  }}
                  >
                    {provider.requireApiKey && provider.id !== 'aliyun-asr' && (
                      <div>
                        <label style={{
                          fontSize: '12px',
                          color: '#666',
                          marginBottom: '6px',
                          display: 'block',
                        }}
                        >
                          {t.settings.apiKey}
                        </label>
                        <input
                          type="password"
                          value={config.apiKey || ''}
                          onChange={(e) => updateProviderConfig(provider.id, { apiKey: e.target.value })}
                          placeholder={`${provider.name} API key`}
                          style={{
                            width: '100%',
                            padding: '10px 14px',
                            background: '#0f0f0f',
                            border: '1px solid #2a2a2a',
                            borderRadius: '6px',
                            color: '#fff',
                            fontSize: '13px',
                          }}
                        />
                      </div>
                    )}

                    {provider.id === 'aliyun-asr' && (
                      <AliyunCredentialInputs
                        providerId={provider.id}
                        config={config}
                        onUpdate={updateProviderConfig}
                      />
                    )}

                    {provider.supportedModels.length > 1 && (
                      <div>
                        <label style={{
                          fontSize: '12px',
                          color: '#666',
                          marginBottom: '6px',
                          display: 'block',
                        }}
                        >
                          {t.settings.model}
                        </label>
                        <select
                          value={config.model || provider.defaultModel || provider.supportedModels[0]}
                          onChange={(e) => updateProviderConfig(provider.id, { model: e.target.value })}
                          style={{
                            width: '100%',
                            padding: '10px 14px',
                            background: '#0f0f0f',
                            border: '1px solid #2a2a2a',
                            borderRadius: '6px',
                            color: '#fff',
                            fontSize: '13px',
                          }}
                        >
                          {provider.supportedModels.map((model) => (
                            <option key={model} value={model}>{model}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {provider.defaultBaseUrl && (
                      <div>
                        <label style={{
                          fontSize: '12px',
                          color: '#666',
                          marginBottom: '6px',
                          display: 'block',
                        }}
                        >
                          {t.settings.baseUrl}
                        </label>
                        <input
                          type="text"
                          value={config.baseUrl || provider.defaultBaseUrl}
                          onChange={(e) => updateProviderConfig(provider.id, { baseUrl: e.target.value })}
                          style={{
                            width: '100%',
                            padding: '10px 14px',
                            background: '#0f0f0f',
                            border: '1px solid #2a2a2a',
                            borderRadius: '6px',
                            color: '#fff',
                            fontSize: '13px',
                          }}
                        />
                      </div>
                    )}

                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      marginTop: '4px',
                    }}
                    >
                      <button
                        onClick={() => testProvider(provider.id)}
                        disabled={isTesting}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '8px 14px',
                          borderRadius: '6px',
                          border: '1px solid #333',
                          background: '#222',
                          color: '#999',
                          fontSize: '13px',
                          cursor: isTesting ? 'not-allowed' : 'pointer',
                          opacity: isTesting ? 0.6 : 1,
                        }}
                      >
                        <Zap size={14} />
                        {isTesting ? t.settings.testing : t.settings.test}
                      </button>

                      {testRes && (
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '13px',
                          color: testRes.success ? '#22c55e' : '#ef4444',
                        }}
                        >
                          {testRes.success ? (
                            <><Check size={14} /> Connected</>
                          ) : (
                            <><AlertCircle size={14} /> {testRes.error}</>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section style={{ marginTop: '32px' }}>
        <h2 style={{
          fontSize: '14px',
          fontWeight: 600,
          color: '#666',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          marginBottom: '20px',
        }}
        >
          {t.settings.postProcessingProviders || 'Post-Processing Providers'}
        </h2>
        <p style={{
          fontSize: '13px',
          color: '#888',
          marginBottom: '16px',
        }}
        >
          {t.settings.postProcessingProvidersDescription || 'Configure AI providers for text optimization and polishing'}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {postProcessingProviders.map((provider) => {
            const config = providerConfigs[provider.id] || { enabled: false };
            const isTesting = testingProvider === provider.id;
            const testRes = testResult?.id === provider.id ? testResult : null;

            return (
              <div
                key={provider.id}
                style={{
                  background: '#161616',
                  border: '1px solid #222',
                  borderRadius: '12px',
                  padding: '20px',
                }}
              >
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: (config.enabledForPostProcessing ?? config.enabled) ? '16px' : 0,
                }}
                >
                  <div>
                    <h3 style={{
                      fontSize: '16px',
                      fontWeight: 600,
                      color: '#fff',
                      margin: '0 0 4px 0',
                    }}
                    >
                      {provider.name}
                    </h3>
                    <p style={{
                      fontSize: '13px',
                      color: '#666',
                      margin: 0,
                    }}
                    >
                      {provider.description}
                    </p>
                  </div>

                  <button
                    onClick={() => updateProviderConfig(provider.id, { enabledForPostProcessing: !(config.enabledForPostProcessing ?? config.enabled) })}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '6px',
                      border: (config.enabledForPostProcessing ?? config.enabled) ? '1px solid #22c55e' : '1px solid #333',
                      background: (config.enabledForPostProcessing ?? config.enabled) ? 'rgba(34, 197, 94, 0.1)' : '#222',
                      color: (config.enabledForPostProcessing ?? config.enabled) ? '#22c55e' : '#666',
                      fontSize: '13px',
                      fontWeight: 500,
                      cursor: 'pointer',
                    }}
                  >
                    {(config.enabledForPostProcessing ?? config.enabled) ? t.settings.enabled : 'Disabled'}
                  </button>
                </div>

                {(config.enabledForPostProcessing ?? config.enabled) && (
                  <div style={{
                    paddingTop: '16px',
                    borderTop: '1px solid #222',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                  }}
                  >
                    {provider.requireApiKey && (
                      <div>
                        <label style={{
                          fontSize: '12px',
                          color: '#666',
                          marginBottom: '6px',
                          display: 'block',
                        }}
                        >
                          {t.settings.apiKey}
                        </label>
                        <input
                          type="password"
                          value={config.apiKey || ''}
                          onChange={(e) => updateProviderConfig(provider.id, { apiKey: e.target.value })}
                          placeholder={`${provider.name} API key`}
                          style={{
                            width: '100%',
                            padding: '10px 14px',
                            background: '#0f0f0f',
                            border: '1px solid #2a2a2a',
                            borderRadius: '6px',
                            color: '#fff',
                            fontSize: '13px',
                          }}
                        />
                      </div>
                    )}

                    {provider.supportedModels.length > 1 && (
                      <div>
                        <label style={{
                          fontSize: '12px',
                          color: '#666',
                          marginBottom: '6px',
                          display: 'block',
                        }}
                        >
                          {t.settings.model}
                        </label>
                        <select
                          value={config.model || provider.defaultModel || provider.supportedModels[0]}
                          onChange={(e) => updateProviderConfig(provider.id, { model: e.target.value })}
                          style={{
                            width: '100%',
                            padding: '10px 14px',
                            background: '#0f0f0f',
                            border: '1px solid #2a2a2a',
                            borderRadius: '6px',
                            color: '#fff',
                            fontSize: '13px',
                          }}
                        >
                          {provider.supportedModels.map((model) => (
                            <option key={model} value={model}>{model}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {provider.defaultBaseUrl && (
                      <div>
                        <label style={{
                          fontSize: '12px',
                          color: '#666',
                          marginBottom: '6px',
                          display: 'block',
                        }}
                        >
                          {t.settings.baseUrl}
                        </label>
                        <input
                          type="text"
                          value={config.baseUrl || provider.defaultBaseUrl}
                          onChange={(e) => updateProviderConfig(provider.id, { baseUrl: e.target.value })}
                          style={{
                            width: '100%',
                            padding: '10px 14px',
                            background: '#0f0f0f',
                            border: '1px solid #2a2a2a',
                            borderRadius: '6px',
                            color: '#fff',
                            fontSize: '13px',
                          }}
                        />
                      </div>
                    )}

                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      marginTop: '4px',
                    }}
                    >
                      <button
                        onClick={() => testProvider(provider.id)}
                        disabled={isTesting}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '8px 14px',
                          borderRadius: '6px',
                          border: '1px solid #333',
                          background: '#222',
                          color: '#999',
                          fontSize: '13px',
                          cursor: isTesting ? 'not-allowed' : 'pointer',
                          opacity: isTesting ? 0.6 : 1,
                        }}
                      >
                        <Zap size={14} />
                        {isTesting ? t.settings.testing : t.settings.test}
                      </button>

                      {testRes && (
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '13px',
                          color: testRes.success ? '#22c55e' : '#ef4444',
                        }}
                        >
                          {testRes.success ? (
                            <><Check size={14} /> Connected</>
                          ) : (
                            <><AlertCircle size={14} /> {testRes.error}</>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section style={{ marginTop: '32px' }}>
        <h2 style={{
          fontSize: '14px',
          fontWeight: 600,
          color: '#666',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          marginBottom: '20px',
        }}>
          {t.settings.aiPostProcessing}
        </h2>

        <div style={{
          background: '#161616',
          border: '1px solid #222',
          borderRadius: '12px',
          padding: '20px',
        }}>
          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              cursor: 'pointer',
            }}
            >
              <input
                type="checkbox"
                checked={aiSettings.enabled}
                onChange={(e) => updateAiSettings({ enabled: e.target.checked })}
                style={{
                  width: '18px',
                  height: '18px',
                  accentColor: '#6366f1',
                }}
              />
              <div>
                <p style={{
                  fontSize: '14px',
                  fontWeight: 500,
                  color: '#ccc',
                  margin: 0,
                }}
                >
                  {t.settings.enableAiPostProcessing}
                </p>
                <p style={{
                  fontSize: '12px',
                  color: '#555',
                  margin: 0,
                }}
                >
                  {t.settings.aiPostProcessingDescription}
                </p>
              </div>
            </label>
          </div>

          {aiSettings.enabled && (
            <>
              {/* Processing Options */}
              <div style={{ marginBottom: '20px' }}>
                <p style={{
                  fontSize: '13px',
                  fontWeight: 500,
                  color: '#999',
                  marginBottom: '12px',
                }}
                >
                  {t.settings.processingOptions}
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    color: '#aaa',
                  }}
                  >
                    <input
                      type="checkbox"
                      checked={aiSettings.options.removeFillerWords}
                      onChange={(e) => updateAiSettings({
                        options: { ...aiSettings.options, removeFillerWords: e.target.checked }
                      })}
                      style={{ accentColor: '#6366f1' }}
                    />
                    {t.settings.removeFillerWords}
                  </label>

                  <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    color: '#aaa',
                  }}
                  >
                    <input
                      type="checkbox"
                      checked={aiSettings.options.removeRepetition}
                      onChange={(e) => updateAiSettings({
                        options: { ...aiSettings.options, removeRepetition: e.target.checked }
                      })}
                      style={{ accentColor: '#6366f1' }}
                    />
                    {t.settings.removeRepetition}
                  </label>

                  <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    color: '#aaa',
                  }}
                  >
                    <input
                      type="checkbox"
                      checked={aiSettings.options.detectSelfCorrection}
                      onChange={(e) => updateAiSettings({
                        options: { ...aiSettings.options, detectSelfCorrection: e.target.checked }
                      })}
                      style={{ accentColor: '#6366f1' }}
                    />
                    {t.settings.detectSelfCorrection}
                  </label>

                  <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    color: '#aaa',
                  }}
                  >
                    <input
                      type="checkbox"
                      checked={aiSettings.options.restorePunctuation ?? true}
                      onChange={(e) => updateAiSettings({
                        options: { ...aiSettings.options, restorePunctuation: e.target.checked }
                      })}
                      style={{ accentColor: '#6366f1' }}
                    />
                    Restore punctuation
                  </label>
                </div>
              </div>

              {/* Show Comparison Toggle */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  color: '#aaa',
                }}
                >
                  <input
                    type="checkbox"
                    checked={aiSettings.showComparison}
                    onChange={(e) => updateAiSettings({ showComparison: e.target.checked })}
                    style={{ accentColor: '#6366f1' }}
                  />
                  {t.settings.showComparison}
                </label>
              </div>

              {/* AI Provider Status */}
              <div style={{
                padding: '12px',
                background: aiAvailable ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                borderRadius: '8px',
                border: `1px solid ${aiAvailable ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
              }}
              >
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '13px',
                  color: aiAvailable ? '#22c55e' : '#ef4444',
                }}
                >
                  {aiAvailable ? (
                    <><Check size={14} /> {t.settings.aiAvailable}</>
                  ) : (
                    <><AlertCircle size={14} /> {t.settings.configureAiProvider}</>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </section>

      {/* Voice Input Modes Section */}
      <section style={{ marginTop: '32px' }}>
        <h2 style={{
          fontSize: '14px',
          fontWeight: 600,
          color: '#666',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          marginBottom: '20px',
        }}
        >
          Voice Input Modes
        </h2>

        <div style={{
          background: '#161616',
          border: '1px solid #222',
          borderRadius: '12px',
          padding: '20px',
        }}
        >
          <p style={{
            fontSize: '13px',
            color: '#888',
            marginBottom: '16px',
          }}
          >
            Enable or disable different voice input modes and their keyboard shortcuts
          </p>

          {/* Basic Voice Input */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
            }}
            >
              <div>
                <p style={{
                  fontSize: '14px',
                  fontWeight: 500,
                  color: '#ccc',
                  margin: '0 0 4px 0',
                }}
                >
                  Basic Voice Input
                </p>
                <p style={{
                  fontSize: '12px',
                  color: '#666',
                  margin: 0,
                }}
                >
                  Hold hotkey to speak, release to send. Auto-removes filler words.
                </p>
              </div>
              <input
                type="checkbox"
                checked={voiceInputModes.basicVoiceInput}
                onChange={(e) => updateVoiceInputMode('basicVoiceInput', e.target.checked)}
                style={{
                  width: '18px',
                  height: '18px',
                  accentColor: '#6366f1',
                }}
              />
            </label>
          </div>

          {/* Hands-free Mode */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
            }}
            >
              <div>
                <p style={{
                  fontSize: '14px',
                  fontWeight: 500,
                  color: '#ccc',
                  margin: '0 0 4px 0',
                }}
                >
                  Hands-free Mode
                </p>
                <p style={{
                  fontSize: '12px',
                  color: '#666',
                  margin: 0,
                }}
                >
                  Toggle continuous recording mode. Press again to stop.
                </p>
              </div>
              <input
                type="checkbox"
                checked={voiceInputModes.handsFreeMode}
                onChange={(e) => updateVoiceInputMode('handsFreeMode', e.target.checked)}
                style={{
                  width: '18px',
                  height: '18px',
                  accentColor: '#6366f1',
                }}
              />
            </label>
          </div>

          {/* Translate to English */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
            }}
            >
              <div>
                <p style={{
                  fontSize: '14px',
                  fontWeight: 500,
                  color: '#ccc',
                  margin: '0 0 4px 0',
                }}
                >
                  Translate to English
                </p>
                <p style={{
                  fontSize: '12px',
                  color: '#666',
                  margin: 0,
                }}
                >
                  Speak in Chinese, output structured English text.
                </p>
              </div>
              <input
                type="checkbox"
                checked={voiceInputModes.translateToEnglish}
                onChange={(e) => updateVoiceInputMode('translateToEnglish', e.target.checked)}
                style={{
                  width: '18px',
                  height: '18px',
                  accentColor: '#6366f1',
                }}
              />
            </label>
          </div>

          {/* Translation Language Pair */}
          {voiceInputModes.translateToEnglish && (
            <div style={{ marginBottom: '16px', paddingLeft: '16px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '13px', color: '#888' }}>Language pair:</span>
                <select
                  value={translatePair}
                  onChange={async (e) => {
                    const [source, target] = e.target.value.split('→');
                    setTranslatePair(e.target.value);
                    await window.electronAPI.storeSet('translateSettings', { sourceLang: source, targetLang: target });
                  }}
                  style={{
                    padding: '6px 12px',
                    background: '#0f0f0f',
                    border: '1px solid #2a2a2a',
                    borderRadius: '6px',
                    color: '#ccc',
                    fontSize: '13px',
                  }}
                >
                  <option value="zh→en">CN → EN</option>
                  <option value="en→zh">EN → CN</option>
                  <option value="zh→ja">CN → JP</option>
                  <option value="ja→zh">JP → CN</option>
                  <option value="zh→ko">CN → KR</option>
                  <option value="ko→zh">KR → CN</option>
                  <option value="en→ja">EN → JP</option>
                  <option value="en→ko">EN → KR</option>
                </select>
              </label>
            </div>
          )}

          {/* Edit Selected Text */}
          <div>
            <label style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
            }}
            >
              <div>
                <p style={{
                  fontSize: '14px',
                  fontWeight: 500,
                  color: '#ccc',
                  margin: '0 0 4px 0',
                }}
                >
                  Edit Selected Text
                </p>
                <p style={{
                  fontSize: '12px',
                  color: '#666',
                  margin: 0,
                }}
                >
                  Select text, then speak commands like "translate to English" or "make it formal".
                </p>
              </div>
              <input
                type="checkbox"
                checked={voiceInputModes.editSelectedText}
                onChange={(e) => updateVoiceInputMode('editSelectedText', e.target.checked)}
                style={{
                  width: '18px',
                  height: '18px',
                  accentColor: '#6366f1',
                }}
              />
            </label>
          </div>
        </div>
      </section>

      {/* Local Models Section */}
      <section style={{ marginTop: '32px' }}>
        <h2 style={{
          fontSize: '14px',
          fontWeight: 600,
          color: '#666',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          marginBottom: '20px',
        }}>
          Local Models
        </h2>

        <div style={{
          background: '#161616',
          border: '1px solid #222',
          borderRadius: '12px',
          padding: '20px',
          marginBottom: '16px',
        }}>
          <p style={{ fontSize: '13px', color: '#888', marginBottom: '16px' }}>
            Manage locally downloaded whisper.cpp transcription models.
          </p>

          {localModels.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px', color: '#444', fontSize: '13px' }}>
              <p style={{ margin: '0 0 8px 0' }}>No local whisper.cpp models found</p>
              <p style={{ margin: 0, color: '#333' }}>
                Download models from{' '}
                <a href="https://huggingface.co/ggerganov/whisper.cpp" target="_blank" rel="noopener" style={{ color: '#818cf8' }}>
                  huggingface.co/ggerganov/whisper.cpp
                </a>
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {localModels.map(model => (
                <div key={model.path} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#0f0f0f', borderRadius: '8px' }}>
                  <div>
                    <p style={{ fontSize: '13px', color: '#ccc', margin: '0 0 2px 0', fontFamily: 'monospace' }}>{model.name}</p>
                    <p style={{ fontSize: '11px', color: '#555', margin: 0 }}>{model.path}</p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '12px', color: '#666' }}>{formatBytes(model.size)}</span>
                    <button
                      onClick={async () => {
                        if (!confirm(`Delete ${model.name}?`)) return;
                        setDeletingModel(model.path);
                        const deleted = await window.electronAPI.modelsDelete(model.path);
                        setDeletingModel(null);
                        if (deleted) {
                          setLocalModels(prev => prev.filter(m => m.path !== model.path));
                        }
                      }}
                      disabled={deletingModel === model.path}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '4px',
                        border: '1px solid #333',
                        background: '#1a1a1a',
                        color: deletingModel === model.path ? '#555' : '#ef4444',
                        fontSize: '12px',
                        cursor: deletingModel === model.path ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {deletingModel === model.path ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <p style={{ fontSize: '12px', color: '#555', marginTop: '12px' }}>
            Model files are stored in <code style={{ color: '#666' }}>~/Library/Application Support/OpenType/models/</code>
          </p>
        </div>
      </section>

      {/* Data Management Section */}
      <section style={{ marginBottom: '48px' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          marginBottom: '24px',
          paddingBottom: '16px',
          borderBottom: '1px solid #222',
        }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
            </svg>
          </div>
          <div>
            <h2 style={{
              fontSize: '20px',
              fontWeight: 600,
              color: '#fff',
              margin: 0,
            }}>
              Data Management
            </h2>
            <p style={{
              fontSize: '13px',
              color: '#666',
              margin: '4px 0 0 0',
            }}>
              Export and manage your local data
            </p>
          </div>
        </div>

        <DataManagementSection />
      </section>
    </div>
  );
}

// Data Management Component
function DataManagementSection() {
  const [storageStats, setStorageStats] = useState({
    historyCount: 0,
    dictionaryCount: 0,
    tempFilesCount: 0,
    tempFilesSize: 0,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState<'clear-history' | 'clear-cache' | 'clear-all' | null>(null);
  const [confirmText, setConfirmText] = useState('');

  useEffect(() => {
    loadStorageStats();
  }, []);

  const loadStorageStats = async () => {
    try {
      const stats = await window.electronAPI.getStorageStats();
      setStorageStats(stats);
    } catch (error) {
      console.error('Failed to load storage stats:', error);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleExportHistory = async (format: 'json' | 'csv') => {
    setIsLoading(true);
    setExportStatus(null);
    try {
      const result = await window.electronAPI.exportHistory(format);
      if (result.success && result.data) {
        const filename = `opentype-history-${new Date().toISOString().split('T')[0]}.${format}`;
        const saveResult = await window.electronAPI.saveExportFile(result.data, filename);
        if (saveResult.success) {
          setExportStatus(`History exported to ${saveResult.path}`);
        } else if (saveResult.canceled) {
          setExportStatus('Export canceled');
        } else {
          setExportStatus(`Export failed: ${saveResult.error}`);
        }
      } else {
        setExportStatus(`Export failed: ${result.error}`);
      }
    } catch (error: any) {
      setExportStatus(`Export error: ${error.message}`);
    } finally {
      setIsLoading(false);
      setTimeout(() => setExportStatus(null), 3000);
    }
  };

  const handleExportDictionary = async () => {
    setIsLoading(true);
    setExportStatus(null);
    try {
      const result = await window.electronAPI.exportDictionary();
      if (result.success && result.data) {
        const filename = `opentype-dictionary-${new Date().toISOString().split('T')[0]}.json`;
        const saveResult = await window.electronAPI.saveExportFile(result.data, filename);
        if (saveResult.success) {
          setExportStatus(`Dictionary exported to ${saveResult.path}`);
        } else if (saveResult.canceled) {
          setExportStatus('Export canceled');
        } else {
          setExportStatus(`Export failed: ${saveResult.error}`);
        }
      } else {
        setExportStatus(`Export failed: ${result.error}`);
      }
    } catch (error: any) {
      setExportStatus(`Export error: ${error.message}`);
    } finally {
      setIsLoading(false);
      setTimeout(() => setExportStatus(null), 3000);
    }
  };

  const handleExportSettings = async () => {
    setIsLoading(true);
    setExportStatus(null);
    try {
      const result = await window.electronAPI.exportSettings();
      if (result.success && result.data) {
        const filename = `opentype-settings-${new Date().toISOString().split('T')[0]}.json`;
        const saveResult = await window.electronAPI.saveExportFile(result.data, filename);
        if (saveResult.success) {
          setExportStatus(`Settings exported to ${saveResult.path}`);
        } else if (saveResult.canceled) {
          setExportStatus('Export canceled');
        } else {
          setExportStatus(`Export failed: ${saveResult.error}`);
        }
      } else {
        setExportStatus(`Export failed: ${result.error}`);
      }
    } catch (error: any) {
      setExportStatus(`Export error: ${error.message}`);
    } finally {
      setIsLoading(false);
      setTimeout(() => setExportStatus(null), 3000);
    }
  };

  const handleClearHistory = async () => {
    if (confirmText !== 'DELETE') return;
    setIsLoading(true);
    try {
      await window.electronAPI.historyClear();
      await loadStorageStats();
      setShowConfirmDialog(null);
      setConfirmText('');
      setExportStatus('History cleared successfully');
    } catch (error: any) {
      setExportStatus(`Failed to clear history: ${error.message}`);
    } finally {
      setIsLoading(false);
      setTimeout(() => setExportStatus(null), 3000);
    }
  };

  const handleClearCache = async () => {
    setIsLoading(true);
    try {
      const result = await window.electronAPI.clearTemporaryFiles(0);
      await loadStorageStats();
      setShowConfirmDialog(null);
      setExportStatus(`Cache cleared. Deleted ${result.deleted} files, freed ${formatBytes(result.freedBytes)}`);
    } catch (error: any) {
      setExportStatus(`Failed to clear cache: ${error.message}`);
    } finally {
      setIsLoading(false);
      setTimeout(() => setExportStatus(null), 5000);
    }
  };

  const handleClearAll = async () => {
    if (confirmText !== 'DELETE ALL') return;
    setIsLoading(true);
    try {
      await window.electronAPI.clearAllData(true);
      await loadStorageStats();
      setShowConfirmDialog(null);
      setConfirmText('');
      setExportStatus('All data cleared. Settings have been reset.');
    } catch (error: any) {
      setExportStatus(`Failed to clear data: ${error.message}`);
    } finally {
      setIsLoading(false);
      setTimeout(() => setExportStatus(null), 3000);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Version & Updates */}
      <div style={{
        background: '#161616',
        border: '1px solid #222',
        borderRadius: '12px',
        padding: '20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
      }}>
        <div>
          <div style={{ fontSize: '13px', color: '#666', marginBottom: '4px' }}>OpenType</div>
          <div style={{ fontSize: '20px', fontWeight: 700, color: '#fff' }}>
            <span>v{_versionDisplay}</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', color: '#22c55e', background: 'rgba(34,197,94,0.1)', padding: '4px 10px', borderRadius: '20px' }}>
            Auto-update enabled
          </span>
          <button
            onClick={() => window.electronAPI.updateCheck()}
            style={{
              padding: '8px 16px',
              background: '#6366f1',
              border: 'none',
              borderRadius: '8px',
              color: '#fff',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Check for Updates
          </button>
        </div>
      </div>

      {/* Storage Stats */}
      <div style={{
        background: '#161616',
        border: '1px solid #222',
        borderRadius: '12px',
        padding: '20px',
      }}>
        <h3 style={{
          fontSize: '14px',
          fontWeight: 600,
          color: '#fff',
          margin: '0 0 16px 0',
        }}>
          Storage Usage
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
          <StatCard label="History Items" value={storageStats.historyCount.toString()} />
          <StatCard label="Dictionary Entries" value={storageStats.dictionaryCount.toString()} />
          <StatCard label="Temp Files" value={storageStats.tempFilesCount.toString()} />
          <StatCard label="Temp Storage" value={formatBytes(storageStats.tempFilesSize)} />
        </div>
        <button
          onClick={loadStorageStats}
          disabled={isLoading}
          style={{
            marginTop: '16px',
            padding: '8px 16px',
            background: 'transparent',
            border: '1px solid #333',
            borderRadius: '6px',
            color: '#666',
            fontSize: '13px',
            cursor: 'pointer',
          }}
        >
          Refresh
        </button>
      </div>

      {/* Export Section */}
      <div style={{
        background: '#161616',
        border: '1px solid #222',
        borderRadius: '12px',
        padding: '20px',
      }}>
        <h3 style={{
          fontSize: '14px',
          fontWeight: 600,
          color: '#fff',
          margin: '0 0 16px 0',
        }}>
          Export Data
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <ExportRow
            label="Transcription History"
            description={`${storageStats.historyCount} items`}
            onExportJSON={() => handleExportHistory('json')}
            onExportCSV={() => handleExportHistory('csv')}
            disabled={storageStats.historyCount === 0 || isLoading}
          />
          <ExportRow
            label="Custom Dictionary"
            description={`${storageStats.dictionaryCount} entries`}
            onExportJSON={handleExportDictionary}
            disabled={storageStats.dictionaryCount === 0 || isLoading}
            hideCSV
          />
          <ExportRow
            label="Settings"
            description="App configuration (API keys excluded)"
            onExportJSON={handleExportSettings}
            disabled={isLoading}
            hideCSV
          />
        </div>
        {exportStatus && (
          <p style={{
            marginTop: '12px',
            fontSize: '13px',
            color: exportStatus.includes('failed') || exportStatus.includes('error') ? '#ef4444' : '#22c55e',
          }}>
            {exportStatus}
          </p>
        )}
      </div>

      {/* Cleanup Section */}
      <div style={{
        background: '#161616',
        border: '1px solid #222',
        borderRadius: '12px',
        padding: '20px',
      }}>
        <h3 style={{
          fontSize: '14px',
          fontWeight: 600,
          color: '#fff',
          margin: '0 0 16px 0',
        }}>
          Data Cleanup
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <CleanupRow
            label="Clear History"
            description="Delete all transcription records and associated audio files"
            onClick={() => setShowConfirmDialog('clear-history')}
            disabled={storageStats.historyCount === 0 || isLoading}
            danger
          />
          <CleanupRow
            label="Clear Cache"
            description="Remove temporary audio files"
            onClick={() => setShowConfirmDialog('clear-cache')}
            disabled={storageStats.tempFilesCount === 0 || isLoading}
          />
          <CleanupRow
            label="Clear All Data"
            description="Delete everything and reset settings to defaults"
            onClick={() => setShowConfirmDialog('clear-all')}
            disabled={isLoading}
            danger
          />
        </div>
      </div>

      {/* Confirmation Dialog */}
      {showConfirmDialog && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div style={{
            background: '#1a1a1a',
            border: '1px solid #333',
            borderRadius: '12px',
            padding: '24px',
            maxWidth: '400px',
            width: '90%',
          }}>
            <h3 style={{
              fontSize: '18px',
              fontWeight: 600,
              color: showConfirmDialog === 'clear-all' ? '#ef4444' : '#fff',
              margin: '0 0 12px 0',
            }}>
              {showConfirmDialog === 'clear-history' && 'Clear History?'}
              {showConfirmDialog === 'clear-cache' && 'Clear Cache?'}
              {showConfirmDialog === 'clear-all' && 'Clear All Data?'}
            </h3>
            <p style={{
              fontSize: '14px',
              color: '#888',
              margin: '0 0 16px 0',
              lineHeight: 1.5,
            }}>
              {showConfirmDialog === 'clear-history' && 'This will permanently delete all transcription history and associated audio files. This action cannot be undone.'}
              {showConfirmDialog === 'clear-cache' && `This will delete ${storageStats.tempFilesCount} temporary files (${formatBytes(storageStats.tempFilesSize)}).`}
              {showConfirmDialog === 'clear-all' && 'This will delete ALL data including history, dictionary, and reset all settings to defaults. API keys in secure storage will be preserved. This action cannot be undone.'}
            </p>
            {(showConfirmDialog === 'clear-history' || showConfirmDialog === 'clear-all') && (
              <div style={{ marginBottom: '16px' }}>
                <p style={{
                  fontSize: '13px',
                  color: '#666',
                  margin: '0 0 8px 0',
                }}>
                  Type "{showConfirmDialog === 'clear-all' ? 'DELETE ALL' : 'DELETE'}" to confirm:
                </p>
                <input
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder={showConfirmDialog === 'clear-all' ? 'DELETE ALL' : 'DELETE'}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    background: '#222',
                    border: '1px solid #333',
                    borderRadius: '6px',
                    color: '#fff',
                    fontSize: '14px',
                  }}
                />
              </div>
            )}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setShowConfirmDialog(null);
                  setConfirmText('');
                }}
                style={{
                  padding: '10px 16px',
                  background: 'transparent',
                  border: '1px solid #333',
                  borderRadius: '6px',
                  color: '#888',
                  fontSize: '14px',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={
                  showConfirmDialog === 'clear-history' ? handleClearHistory :
                  showConfirmDialog === 'clear-cache' ? handleClearCache :
                  handleClearAll
                }
                disabled={
                  isLoading ||
                  ((showConfirmDialog === 'clear-history' || showConfirmDialog === 'clear-all') &&
                    confirmText !== (showConfirmDialog === 'clear-all' ? 'DELETE ALL' : 'DELETE'))
                }
                style={{
                  padding: '10px 16px',
                  background: showConfirmDialog === 'clear-all' ? '#ef4444' : '#6366f1',
                  border: 'none',
                  borderRadius: '6px',
                  color: '#fff',
                  fontSize: '14px',
                  cursor: 'pointer',
                  opacity: isLoading ? 0.5 : 1,
                }}
              >
                {isLoading ? 'Processing...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Alibaba Cloud Credential Inputs Component
function AliyunCredentialInputs({
  providerId,
  config,
  onUpdate,
}: {
  providerId: string;
  config: ProviderConfig;
  onUpdate: (id: string, updates: Partial<ProviderConfig> & { credentials?: Record<string, string> }) => void;
}) {
  const [accessKeyId, setAccessKeyId] = useState('');
  const [accessKeySecret, setAccessKeySecret] = useState('');

  const handleSave = () => {
    if (accessKeyId && accessKeySecret) {
      onUpdate(providerId, {
        credentials: {
          accessKeyId,
          accessKeySecret,
        },
      });
      // Clear inputs after save for security
      setAccessKeyId('');
      setAccessKeySecret('');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div>
        <label style={{
          fontSize: '12px',
          color: '#666',
          marginBottom: '6px',
          display: 'block',
        }}>
          AccessKey ID
        </label>
        <input
          type="password"
          value={accessKeyId}
          onChange={(e) => setAccessKeyId(e.target.value)}
          placeholder="Enter Alibaba Cloud AccessKey ID"
          style={{
            width: '100%',
            padding: '10px 14px',
            background: '#0f0f0f',
            border: '1px solid #2a2a2a',
            borderRadius: '6px',
            color: '#fff',
            fontSize: '13px',
          }}
        />
      </div>
      <div>
        <label style={{
          fontSize: '12px',
          color: '#666',
          marginBottom: '6px',
          display: 'block',
        }}>
          AccessKey Secret
        </label>
        <input
          type="password"
          value={accessKeySecret}
          onChange={(e) => setAccessKeySecret(e.target.value)}
          placeholder="Enter Alibaba Cloud AccessKey Secret"
          style={{
            width: '100%',
            padding: '10px 14px',
            background: '#0f0f0f',
            border: '1px solid #2a2a2a',
            borderRadius: '6px',
            color: '#fff',
            fontSize: '13px',
          }}
        />
      </div>
      {config.hasKeyInKeychain && (
        <p style={{
          fontSize: '12px',
          color: '#22c55e',
          margin: 0,
        }}>
          ✓ Credentials saved in secure storage
        </p>
      )}
      <button
        onClick={handleSave}
        disabled={!accessKeyId || !accessKeySecret}
        style={{
          padding: '10px 16px',
          background: accessKeyId && accessKeySecret ? '#6366f1' : '#333',
          border: 'none',
          borderRadius: '6px',
          color: accessKeyId && accessKeySecret ? '#fff' : '#666',
          fontSize: '13px',
          cursor: accessKeyId && accessKeySecret ? 'pointer' : 'not-allowed',
        }}
      >
        Save Credentials
      </button>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      background: '#1a1a1a',
      borderRadius: '8px',
      padding: '16px',
      textAlign: 'center',
    }}>
      <p style={{
        fontSize: '24px',
        fontWeight: 600,
        color: '#fff',
        margin: '0 0 4px 0',
      }}>
        {value}
      </p>
      <p style={{
        fontSize: '12px',
        color: '#666',
        margin: 0,
      }}>
        {label}
      </p>
    </div>
  );
}

function ExportRow({
  label,
  description,
  onExportJSON,
  onExportCSV,
  disabled,
  hideCSV,
}: {
  label: string;
  description: string;
  onExportJSON: () => void;
  onExportCSV?: () => void;
  disabled: boolean;
  hideCSV?: boolean;
}) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '12px',
      background: '#1a1a1a',
      borderRadius: '8px',
    }}>
      <div>
        <p style={{
          fontSize: '14px',
          fontWeight: 500,
          color: '#ccc',
          margin: '0 0 4px 0',
        }}>
          {label}
        </p>
        <p style={{
          fontSize: '12px',
          color: '#666',
          margin: 0,
        }}>
          {description}
        </p>
      </div>
      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          onClick={onExportJSON}
          disabled={disabled}
          style={{
            padding: '8px 14px',
            background: disabled ? '#222' : '#6366f1',
            border: 'none',
            borderRadius: '6px',
            color: disabled ? '#666' : '#fff',
            fontSize: '13px',
            cursor: disabled ? 'not-allowed' : 'pointer',
          }}
        >
          Export JSON
        </button>
        {!hideCSV && onExportCSV && (
          <button
            onClick={onExportCSV}
            disabled={disabled}
            style={{
              padding: '8px 14px',
              background: disabled ? '#222' : '#333',
              border: '1px solid #444',
              borderRadius: '6px',
              color: disabled ? '#666' : '#ccc',
              fontSize: '13px',
              cursor: disabled ? 'not-allowed' : 'pointer',
            }}
          >
            Export CSV
          </button>
        )}
      </div>
    </div>
  );
}

function CleanupRow({
  label,
  description,
  onClick,
  disabled,
  danger,
}: {
  label: string;
  description: string;
  onClick: () => void;
  disabled: boolean;
  danger?: boolean;
}) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '12px',
      background: '#1a1a1a',
      borderRadius: '8px',
    }}>
      <div>
        <p style={{
          fontSize: '14px',
          fontWeight: 500,
          color: danger ? '#ef4444' : '#ccc',
          margin: '0 0 4px 0',
        }}>
          {label}
        </p>
        <p style={{
          fontSize: '12px',
          color: '#666',
          margin: 0,
        }}>
          {description}
        </p>
      </div>
      <button
        onClick={onClick}
        disabled={disabled}
        style={{
          padding: '8px 14px',
          background: danger ? 'rgba(239, 68, 68, 0.1)' : '#333',
          border: `1px solid ${danger ? '#ef4444' : '#444'}`,
          borderRadius: '6px',
          color: danger ? '#ef4444' : '#ccc',
          fontSize: '13px',
          cursor: disabled ? 'not-allowed' : 'pointer',
        }}
      >
        {label}
      </button>
    </div>
  );
}

// Helper Components

interface StatusRowProps {
  label: string;
  status: 'ready' | 'missing' | 'optional';
  description: string;
}

function StatusRow({ label, status, description }: StatusRowProps) {
  const colors = {
    ready: '#22c55e',
    missing: '#ef4444',
    optional: '#f59e0b',
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '8px 12px',
      background: 'rgba(0,0,0,0.2)',
      borderRadius: '6px',
      fontSize: '13px',
    }}
    >
      {status === 'ready' ? (
        <Check size={14} color={colors[status]} />
      ) : status === 'missing' ? (
        <AlertCircle size={14} color={colors[status]} />
      ) : (
        <Zap size={14} color={colors[status]} />
      )}
      <span style={{ fontWeight: 500, color: colors[status] }}>{label}</span>
      <span style={{ color: '#666', marginLeft: 'auto', fontSize: '12px' }}>{description}</span>
    </div>
  );
}

interface SetupHintProps {
  title: string;
  command: string;
  description: string;
}

function SetupHint({ title, command, description }: SetupHintProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{
      marginTop: '12px',
      padding: '12px 16px',
      background: 'rgba(239, 68, 68, 0.05)',
      borderRadius: '8px',
      border: '1px solid rgba(239, 68, 68, 0.2)',
    }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
        <Terminal size={14} color="#ef4444" />
        <span style={{ fontSize: '13px', fontWeight: 500, color: '#ef4444' }}>{title}</span>
      </div>
      
      <p style={{ fontSize: '12px', color: '#888', margin: '4px 0 8px', lineHeight: 1.4 }}>
        {description}
      </p>
      
      <div style={{
        display: 'flex',
        gap: '8px',
        alignItems: 'center',
      }}
      >
        <code style={{
          flex: 1,
          background: 'rgba(0,0,0,0.3)',
          padding: '8px 12px',
          borderRadius: '6px',
          fontSize: '11px',
          color: '#aaa',
          fontFamily: 'monospace',
          overflow: 'auto',
        }}
        >
          {command}
        </code>
        
        <button
          onClick={handleCopy}
          style={{
            padding: '8px 12px',
            background: copied ? 'rgba(34, 197, 94, 0.2)' : 'rgba(255,255,255,0.1)',
            border: 'none',
            borderRadius: '6px',
            color: copied ? '#22c55e' : '#888',
            fontSize: '12px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          {copied ? <><Check size={12} /> Copied</> : <><ExternalLink size={12} /> Copy</>}
        </button>
      </div>
    </div>
  );
}
