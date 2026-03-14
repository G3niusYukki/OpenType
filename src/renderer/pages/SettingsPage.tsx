import { useState, useEffect } from 'react';
import { Keyboard, Globe, Zap, Check, CheckCircle, AlertCircle, Terminal, ExternalLink } from 'lucide-react';
import { useI18n } from '../i18n';

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
  apiKey?: string;
  baseUrl?: string;
  model?: string;
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
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  const showSaveIndicator = () => {
    setSaveStatus('saving');
    setTimeout(() => setSaveStatus('saved'), 300);
    setTimeout(() => setSaveStatus('idle'), 1500);
  };

  useEffect(() => {
    loadSettings();
    loadProviders();
    loadSystemStatus();
  }, []);

  const loadSettings = async () => {
    const [savedHotkey, savedLanguage, savedPunctuation, savedPreferredProvider, savedAiSettings, savedVoiceModes] = await Promise.all([
      window.electronAPI.storeGet('hotkey'),
      window.electronAPI.storeGet('language'),
      window.electronAPI.storeGet('autoPunctuation'),
      window.electronAPI.storeGet('preferredProvider'),
      window.electronAPI.aiGetSettings(),
      window.electronAPI.storeGet('voiceInputModes'),
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
  };

  const checkAiAvailability = async (settings?: typeof aiSettings) => {
    const aiSet = settings || aiSettings;
    const providers = await window.electronAPI.storeGet('providers') as Array<{ id: string; enabled: boolean; apiKey?: string }>;
    const hasAiProvider = providers?.some(p =>
      p.enabled && p.apiKey && ['openai', 'groq', 'anthropic', 'deepseek', 'zhipu', 'minimax', 'moonshot'].includes(p.id)
    );
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
                  marginBottom: config.enabled ? '16px' : 0,
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
                    onClick={() => updateProviderConfig(provider.id, { enabled: !config.enabled })}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '6px',
                      border: config.enabled ? '1px solid #22c55e' : '1px solid #333',
                      background: config.enabled ? 'rgba(34, 197, 94, 0.1)' : '#222',
                      color: config.enabled ? '#22c55e' : '#666',
                      fontSize: '13px',
                      fontWeight: 500,
                      cursor: 'pointer',
                    }}
                  >
                    {config.enabled ? t.settings.enabled : 'Disabled'}
                  </button>
                </div>

                {config.enabled && (
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
                  marginBottom: config.enabled ? '16px' : 0,
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
                    onClick={() => updateProviderConfig(provider.id, { enabled: !config.enabled })}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '6px',
                      border: config.enabled ? '1px solid #22c55e' : '1px solid #333',
                      background: config.enabled ? 'rgba(34, 197, 94, 0.1)' : '#222',
                      color: config.enabled ? '#22c55e' : '#666',
                      fontSize: '13px',
                      fontWeight: 500,
                      cursor: 'pointer',
                    }}
                  >
                    {config.enabled ? t.settings.enabled : 'Disabled'}
                  </button>
                </div>

                {config.enabled && (
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
