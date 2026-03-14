import { useState, useEffect } from 'react';
import { Keyboard, Globe, Zap, Check, AlertCircle, Terminal, ExternalLink } from 'lucide-react';

interface Provider {
  id: string;
  name: string;
  description: string;
  requireApiKey: boolean;
  defaultBaseUrl?: string;
  defaultModel?: string;
  supportedModels: string[];
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
  const [hotkey, setHotkey] = useState('CommandOrControl+Shift+D');
  const [language, setLanguage] = useState('en-US');
  const [autoPunctuation, setAutoPunctuation] = useState(true);
  const [preferredProvider, setPreferredProvider] = useState<'local' | 'cloud' | 'auto'>('auto');
  const [providers, setProviders] = useState<Provider[]>([]);
  const [providerConfigs, setProviderConfigs] = useState<Record<string, ProviderConfig>>({});
  const [testingProvider, setTestingProvider] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ id: string; success: boolean; error?: string } | null>(null);
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);

  useEffect(() => {
    loadSettings();
    loadProviders();
    loadSystemStatus();
  }, []);

  const loadSettings = async () => {
    const [savedHotkey, savedLanguage, savedPunctuation, savedPreferredProvider] = await Promise.all([
      window.electronAPI.storeGet('hotkey'),
      window.electronAPI.storeGet('language'),
      window.electronAPI.storeGet('autoPunctuation'),
      window.electronAPI.storeGet('preferredProvider'),
    ]);
    
    if (savedHotkey) setHotkey(savedHotkey as string);
    if (savedLanguage) setLanguage(savedLanguage as string);
    if (savedPunctuation !== undefined) setAutoPunctuation(savedPunctuation as boolean);
    if (savedPreferredProvider) setPreferredProvider(savedPreferredProvider as 'local' | 'cloud' | 'auto');
  };

  const loadProviders = async () => {
    const [list, configs] = await Promise.all([
      window.electronAPI.providersList(),
      window.electronAPI.storeGet('providers'),
    ]);
    
    setProviders(list as Provider[]);
    
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
    await window.electronAPI.storeSet('hotkey', value);
  };

  const saveLanguage = async (value: string) => {
    setLanguage(value);
    await window.electronAPI.storeSet('language', value);
  };

  const saveAutoPunctuation = async (value: boolean) => {
    setAutoPunctuation(value);
    await window.electronAPI.storeSet('autoPunctuation', value);
  };

  const savePreferredProvider = async (value: 'local' | 'cloud' | 'auto') => {
    setPreferredProvider(value);
    await window.electronAPI.storeSet('preferredProvider', value);
    // Refresh system status to update active provider display
    setTimeout(loadSystemStatus, 100);
  };

  const updateProviderConfig = async (providerId: string, updates: Partial<ProviderConfig>) => {
    const current = providerConfigs[providerId] || { id: providerId, enabled: false };
    const updated = { ...current, ...updates };
    
    await window.electronAPI.providersSetConfig(providerId, updated);
    
    setProviderConfigs(prev => ({
      ...prev,
      [providerId]: updated,
    }));
    
    // Refresh system status when provider changes
    if (updates.enabled !== undefined || updates.apiKey !== undefined) {
      setTimeout(loadSystemStatus, 100);
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
      <h1 style={{
        fontSize: '24px',
        fontWeight: 600,
        marginBottom: '32px',
        color: '#fff',
      }}>
        Settings
      </h1>

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
          System Status
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
                <h3 style={{ fontSize: '13px', color: '#888', marginBottom: '12px' }}>Dependencies</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <StatusRow
                    label="ffmpeg"
                    status={systemStatus.audio.ffmpegAvailable ? 'ready' : 'missing'}
                    description={systemStatus.audio.ffmpegAvailable ? 'Installed' : 'Required for recording'}
                  />
                  <StatusRow
                    label="Microphone"
                    status={systemStatus.audio.hasAudioDevices ? 'ready' : 'missing'}
                    description={`${systemStatus.audio.deviceCount} device(s) found`}
                  />
                  <StatusRow
                    label="whisper.cpp"
                    status={systemStatus.transcription.whisperInstalled ? 'ready' : 'missing'}
                    description={systemStatus.transcription.whisperInstalled ? 'Installed' : 'Not found'}
                  />
                  <StatusRow
                    label="Model file"
                    status={systemStatus.transcription.modelAvailable ? 'ready' : 'missing'}
                    description={systemStatus.transcription.modelAvailable ? 'Found' : 'Not found'}
                  />
                </div>
                
                {!systemStatus.audio.ffmpegAvailable && (
                  <SetupHint
                    title="ffmpeg not found"
                    command="brew install ffmpeg"
                    description="ffmpeg is required to record audio from your microphone."
                  />
                )}
                
                {!systemStatus.transcription.whisperInstalled && !systemStatus.transcription.hasCloudProvider && (
                  <SetupHint
                    title="whisper.cpp not found"
                    command="brew install whisper.cpp"
                    description="Install whisper.cpp for local transcription, or configure a cloud provider below."
                  />
                )}
                
                {!systemStatus.transcription.modelAvailable && systemStatus.transcription.whisperInstalled && (
                  <SetupHint
                    title="Whisper model not found"
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
                      Ready to transcribe
                    </span>
                    <span style={{ color: '#666', marginLeft: 'auto', fontSize: '13px' }}>
                      Using {systemStatus.transcription.activeProvider}
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
                      No transcription provider configured
                    </span>
                  </div>
                  <p style={{ 
                    margin: '8px 0 0 0', 
                    fontSize: '12px', 
                    color: '#888',
                    paddingLeft: '24px'
                  }}>
                    Install whisper.cpp + model for local transcription, or configure a cloud provider (OpenAI, Groq, etc.) below.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div style={{ color: '#666', textAlign: 'center', padding: '20px' }}>
              Loading system status...
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
          General
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
              <Keyboard size={16} /> Global Hotkey
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
              Format: CommandOrControl+Shift+D, Option+Space, etc.
            </p>
          </div>

          {/* Language Setting */}
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
              <Globe size={16} /> Language
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
              <option value="zh-CN">中文 (简体)</option>
              <option value="zh-TW">中文 (繁體)</option>
              <option value="ja-JP">日本語</option>
              <option value="es-ES">Español</option>
              <option value="fr-FR">Français</option>
              <option value="de-DE">Deutsch</option>
            </select>
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
                  Auto-punctuation
                </p>
                <p style={{
                  fontSize: '12px',
                  color: '#555',
                  margin: 0,
                }}
                >
                  Automatically add periods and commas
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
              <Zap size={16} /> Preferred Provider
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
              <option value="auto">Auto (Local first, fallback to Cloud)</option>
              <option value="local">Local (whisper.cpp only)</option>
              <option value="cloud">Cloud (API only)</option>
            </select>
            <p style={{
              fontSize: '12px',
              color: '#555',
              marginTop: '6px',
            }}
            >
              Choose which transcription provider to use
            </p>
          </div>
        </div>
      </section>

      {/* Providers Section */}
      <section>
        <h2 style={{
          fontSize: '14px',
          fontWeight: 600,
          color: '#666',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          marginBottom: '20px',
        }}
        >
          AI Providers (BYOK)
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {providers.map((provider) => {
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
                    {config.enabled ? 'Enabled' : 'Disabled'}
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
                          API Key
                        </label>
                        <input
                          type="password"
                          value={config.apiKey || ''}
                          onChange={(e) => updateProviderConfig(provider.id, { apiKey: e.target.value })}
                          placeholder={`Enter your ${provider.name} API key`}
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
                          Model
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
                          Base URL
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
                        {isTesting ? 'Testing...' : 'Test Connection'}
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
