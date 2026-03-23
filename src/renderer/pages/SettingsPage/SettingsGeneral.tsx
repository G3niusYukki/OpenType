import { useState, useEffect } from 'react';
import { Keyboard, Globe, Zap, Mic, Check, CheckCircle, AlertCircle, Terminal, ExternalLink } from 'lucide-react';
import { AudioDeviceSelector } from '../../components/AudioDeviceSelector';
import { Card, Input, Select, Toggle } from '../../components/ui';

const LANGUAGES = [
  { value: 'en-US', label: 'English (US)' },
  { value: 'zh-CN', label: '中文 (简体)' },
  { value: 'zh-TW', label: '中文 (繁體)' },
  { value: 'ja-JP', label: '日本語' },
  { value: 'ko-KR', label: '한국어' },
  { value: 'fr-FR', label: 'Français' },
  { value: 'de-DE', label: 'Deutsch' },
  { value: 'es-ES', label: 'Español' },
];

const PROVIDER_OPTIONS = [
  { value: 'auto', label: 'Auto (Local first)' },
  { value: 'local', label: 'Local (whisper.cpp)' },
  { value: 'cloud', label: 'Cloud (API)' },
];

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

export function SettingsGeneral() {
  const [hotkey, setHotkey] = useState('CommandOrControl+Shift+D');
  const [language, setLanguage] = useState('en-US');
  const [autoPunctuation, setAutoPunctuation] = useState(true);
  const [preferredProvider, setPreferredProvider] = useState<'local' | 'cloud' | 'auto'>('auto');
  const [fallbackEnabled, setFallbackEnabled] = useState(true);
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  useEffect(() => {
    loadSettings();
    loadSystemStatus();
  }, []);

  const showSaveIndicator = () => {
    setSaveStatus('saving');
    setTimeout(() => setSaveStatus('saved'), 300);
    setTimeout(() => setSaveStatus('idle'), 1500);
  };

  const loadSettings = async () => {
    const [savedHotkey, savedLanguage, savedPunctuation, savedPreferredProvider, savedFallbackSettings] = await Promise.all([
      window.electronAPI.storeGet('hotkey'),
      window.electronAPI.storeGet('language'),
      window.electronAPI.storeGet('autoPunctuation'),
      window.electronAPI.storeGet('preferredProvider'),
      window.electronAPI.storeGet('fallbackSettings'),
    ]);
    if (savedHotkey) setHotkey(savedHotkey as string);
    if (savedLanguage) setLanguage(savedLanguage as string);
    if (savedPunctuation !== undefined) setAutoPunctuation(savedPunctuation as boolean);
    if (savedPreferredProvider) setPreferredProvider(savedPreferredProvider as 'local' | 'cloud' | 'auto');
    if (savedFallbackSettings) {
      setFallbackEnabled((savedFallbackSettings as { enabled: boolean }).enabled ?? true);
    }
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

  const saveFallbackEnabled = async (enabled: boolean) => {
    setFallbackEnabled(enabled);
    showSaveIndicator();
    const currentSettings = await window.electronAPI.storeGet('fallbackSettings') as { enabled: boolean; providerOrder: string[]; maxAttempts: number } | null;
    await window.electronAPI.storeSet('fallbackSettings', {
      ...(currentSettings || {}),
      enabled,
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-8)' }}>
      {/* Save indicator */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        {saveStatus !== 'idle' && (
          <span style={{
            fontSize: '12px',
            color: saveStatus === 'saving' ? 'var(--color-accent)' : '#22c55e',
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
      <section>
        <h2 className="section-title">System Status</h2>
        <Card glass padding="lg">
          {systemStatus ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)' }}>
                <StatusRow
                  label="FFmpeg"
                  status={systemStatus.audio.ffmpegAvailable ? 'ready' : 'missing'}
                  description={systemStatus.audio.ffmpegAvailable ? 'Installed' : 'Required'}
                />
                <StatusRow
                  label="Microphone"
                  status={systemStatus.audio.hasAudioDevices ? 'ready' : 'missing'}
                  description={`${systemStatus.audio.deviceCount} devices`}
                />
                <StatusRow
                  label="Whisper.cpp"
                  status={systemStatus.transcription.whisperInstalled ? 'ready' : 'missing'}
                  description={systemStatus.transcription.whisperInstalled ? 'Installed' : 'Not found'}
                />
                <StatusRow
                  label="Model File"
                  status={systemStatus.transcription.modelAvailable ? 'ready' : 'missing'}
                  description={systemStatus.transcription.modelAvailable ? 'Found' : 'Not found'}
                />
              </div>

              {!systemStatus.audio.ffmpegAvailable && (
                <SetupHint
                  title="FFmpeg not found"
                  command="brew install ffmpeg"
                  description="FFmpeg is required for audio processing."
                />
              )}

              {!systemStatus.transcription.whisperInstalled && !systemStatus.transcription.hasCloudProvider && (
                <SetupHint
                  title="No transcription provider"
                  command="brew install whisper.cpp"
                  description="Install whisper.cpp or configure a cloud provider to enable transcription."
                />
              )}

              {!systemStatus.transcription.modelAvailable && systemStatus.transcription.whisperInstalled && (
                <SetupHint
                  title="Model file not found"
                  command="mkdir -p ~/Library/Application\ Support/OpenType/models && curl -L -o ~/Library/Application\\ Support/OpenType/models/ggml-base.bin https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin"
                  description="Download a Whisper model to enable local transcription. Base model (~74MB) recommended for most users."
                />
              )}

              {systemStatus.transcription.activeProvider && (
                <div style={{
                  padding: '12px 16px',
                  background: 'rgba(34, 197, 94, 0.1)',
                  borderRadius: '8px',
                  border: '1px solid rgba(34, 197, 94, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}>
                  <Check size={16} color="#22c55e" />
                  <span style={{ color: '#22c55e', fontWeight: 500 }}>Ready to transcribe</span>
                  <span style={{ color: '#666', marginLeft: 'auto', fontSize: '13px' }}>
                    Using {systemStatus.transcription.activeProvider}
                  </span>
                </div>
              )}

              {!systemStatus.transcription.activeProvider && (
                <div style={{
                  padding: '12px 16px',
                  background: 'rgba(239, 68, 68, 0.1)',
                  borderRadius: '8px',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}>
                  <AlertCircle size={16} color="#ef4444" />
                  <span style={{ color: '#ef4444', fontWeight: 500 }}>No provider configured</span>
                </div>
              )}
            </div>
          ) : (
            <div style={{ color: '#666', textAlign: 'center', padding: '20px' }}>Loading...</div>
          )}
        </Card>
      </section>

      {/* Audio Input Device */}
      <section>
        <h2 className="section-title">Audio Input</h2>
        <Card glass padding="lg">
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <AudioDeviceSelector onSave={showSaveIndicator} />
          </div>
        </Card>
      </section>

      {/* General Settings */}
      <section>
        <h2 className="section-title">General</h2>
        <Card glass padding="lg">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: 'var(--space-2)' }}>
                <Keyboard size={14} style={{ color: 'var(--color-text-muted)' }} />
                <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text-secondary)' }}>Global Hotkey</span>
              </div>
              <Input
                type="text"
                value={hotkey}
                onChange={(e) => saveHotkey(e.target.value)}
                placeholder="CommandOrControl+Shift+D"
              />
              <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: 'var(--space-1)', marginBottom: 0 }}>
                Keyboard shortcut to toggle the app window
              </p>
            </div>

            <Select
              label="Transcription Language"
              options={LANGUAGES}
              value={language}
              onChange={(e) => saveLanguage(e.target.value)}
            />

            <Toggle
              label="Auto Punctuation"
              description="Automatically add punctuation to transcriptions"
              checked={autoPunctuation}
              onChange={saveAutoPunctuation}
            />

            <Select
              label="Preferred Provider"
              options={PROVIDER_OPTIONS}
              value={preferredProvider}
              onChange={(e) => savePreferredProvider(e.target.value as 'local' | 'cloud' | 'auto')}
            />

            <Toggle
              label="Enable Provider Fallback"
              description="Automatically try alternative providers if the primary one fails"
              checked={fallbackEnabled}
              onChange={saveFallbackEnabled}
            />
          </div>
        </Card>
      </section>
    </div>
  );
}

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
  const icons = {
    ready: <Check size={14} color={colors[status]} />,
    missing: <AlertCircle size={14} color={colors[status]} />,
    optional: <Zap size={14} color={colors[status]} />,
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
    }}>
      {icons[status]}
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
      marginTop: 'var(--space-2)',
      padding: '12px 16px',
      background: 'rgba(239, 68, 68, 0.05)',
      borderRadius: '8px',
      border: '1px solid rgba(239, 68, 68, 0.2)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
        <Terminal size={14} color="#ef4444" />
        <span style={{ fontSize: '13px', fontWeight: 500, color: '#ef4444' }}>{title}</span>
      </div>
      <p style={{ fontSize: '12px', color: '#888', margin: '4px 0 8px', lineHeight: 1.4 }}>{description}</p>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <code style={{
          flex: 1,
          background: 'rgba(0,0,0,0.3)',
          padding: '8px 12px',
          borderRadius: '6px',
          fontSize: '11px',
          color: '#aaa',
          fontFamily: 'monospace',
          overflow: 'auto',
        }}>
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
