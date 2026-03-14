import { useState, useEffect } from 'react';
import { Keyboard, Globe, Zap, Check, AlertCircle } from 'lucide-react';

interface Provider {
  id: string;
  name: string;
  description: string;
  requireApiKey: boolean;
  defaultBaseUrl?: string;
  supportedModels: string[];
}

interface ProviderConfig {
  id: string;
  enabled: boolean;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
}

export function SettingsPage() {
  const [hotkey, setHotkey] = useState('CommandOrControl+Shift+D');
  const [language, setLanguage] = useState('en-US');
  const [autoPunctuation, setAutoPunctuation] = useState(true);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [providerConfigs, setProviderConfigs] = useState<Record<string, ProviderConfig>>({});
  const [testingProvider, setTestingProvider] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ id: string; success: boolean; error?: string } | null>(null);

  useEffect(() => {
    loadSettings();
    loadProviders();
  }, []);

  const loadSettings = async () => {
    const [savedHotkey, savedLanguage, savedPunctuation] = await Promise.all([
      window.electronAPI.storeGet('hotkey'),
      window.electronAPI.storeGet('language'),
      window.electronAPI.storeGet('autoPunctuation'),
    ]);
    
    if (savedHotkey) setHotkey(savedHotkey as string);
    if (savedLanguage) setLanguage(savedLanguage as string);
    if (savedPunctuation !== undefined) setAutoPunctuation(savedPunctuation as boolean);
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

  const updateProviderConfig = async (providerId: string, updates: Partial<ProviderConfig>) => {
    const current = providerConfigs[providerId] || { id: providerId, enabled: false };
    const updated = { ...current, ...updates };
    
    await window.electronAPI.providersSetConfig(providerId, updated);
    
    setProviderConfigs(prev => ({
      ...prev,
      [providerId]: updated,
    }));
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

      {/* General Section */}
      <section style={{ marginBottom: '40px' }}>
        <h2 style={{
          fontSize: '14px',
          fontWeight: 600,
          color: '#666',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          marginBottom: '20px',
        }}>
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
            }}>
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
            }}>
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
            }}>
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
          <div>
            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              cursor: 'pointer',
            }}>
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
                }}>
                  Auto-punctuation
                </p>
                <p style={{
                  fontSize: '12px',
                  color: '#555',
                  margin: 0,
                }}>
                  Automatically add periods and commas
                </p>
              </div>
            </label>
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
        }}>
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
                }}>
                  <div>
                    <h3 style={{
                      fontSize: '16px',
                      fontWeight: 600,
                      color: '#fff',
                      margin: '0 0 4px 0',
                    }}>
                      {provider.name}
                    </h3>
                    <p style={{
                      fontSize: '13px',
                      color: '#666',
                      margin: 0,
                    }}>
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
                  }}>
                    {provider.requireApiKey && (
                      <div>
                        <label style={{
                          fontSize: '12px',
                          color: '#666',
                          marginBottom: '6px',
                          display: 'block',
                        }}>
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

                    {provider.defaultBaseUrl && (
                      <div>
                        <label style={{
                          fontSize: '12px',
                          color: '#666',
                          marginBottom: '6px',
                          display: 'block',
                        }}>
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
                    }}>
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
                        }}>
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
