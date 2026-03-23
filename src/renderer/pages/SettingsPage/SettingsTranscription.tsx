import { useState, useEffect } from 'react';
import { Zap, Check, CheckCircle, AlertCircle } from 'lucide-react';
import { Card, Button, Badge, Toggle, Input, Select } from '../../components/ui';

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

export function SettingsTranscription() {
  const [transcriptionProviders, setTranscriptionProviders] = useState<Provider[]>([]);
  const [postProcessingProviders, setPostProcessingProviders] = useState<Provider[]>([]);
  const [providerConfigs, setProviderConfigs] = useState<Record<string, ProviderConfig>>({});
  const [testingProvider, setTestingProvider] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ id: string; success: boolean; error?: string } | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  useEffect(() => {
    loadProviders();
  }, []);

  const showSaveIndicator = () => {
    setSaveStatus('saving');
    setTimeout(() => setSaveStatus('saved'), 300);
    setTimeout(() => setSaveStatus('idle'), 1500);
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
    ((configs as ProviderConfig[]) || []).forEach((c) => {
      configMap[c.id] = c;
    });
    setProviderConfigs(configMap);
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
  };

  const testProvider = async (providerId: string) => {
    setTestingProvider(providerId);
    setTestResult(null);

    const result = await window.electronAPI.providersTest(providerId);

    setTestingProvider(null);
    setTestResult({ id: providerId, ...result });
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

      {/* Transcription Providers */}
      <section>
        <h2 className="section-title">Transcription Providers</h2>
        <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: 'var(--space-4)' }}>
          Configure speech-to-text services for audio transcription
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {transcriptionProviders.map((provider) => (
            <ProviderCard
              key={provider.id}
              provider={provider}
              config={providerConfigs[provider.id] || { enabled: false }}
              isTesting={testingProvider === provider.id}
              testResult={testResult?.id === provider.id ? testResult : null}
              onToggle={(enabled) => updateProviderConfig(provider.id, { enabledForTranscription: enabled })}
              onUpdate={(updates) => updateProviderConfig(provider.id, updates)}
              onTest={() => testProvider(provider.id)}
              mode="transcription"
            />
          ))}
        </div>
      </section>

      {/* Post-Processing Providers */}
      <section>
        <h2 className="section-title">Post-Processing Providers</h2>
        <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: 'var(--space-4)' }}>
          Configure AI providers for text optimization and polishing
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {postProcessingProviders.map((provider) => (
            <ProviderCard
              key={provider.id}
              provider={provider}
              config={providerConfigs[provider.id] || { enabled: false }}
              isTesting={testingProvider === provider.id}
              testResult={testResult?.id === provider.id ? testResult : null}
              onToggle={(enabled) => updateProviderConfig(provider.id, { enabledForPostProcessing: enabled })}
              onUpdate={(updates) => updateProviderConfig(provider.id, updates)}
              onTest={() => testProvider(provider.id)}
              mode="post-processing"
            />
          ))}
        </div>
      </section>
    </div>
  );
}

interface ProviderCardProps {
  provider: Provider;
  config: ProviderConfig;
  isTesting: boolean;
  testResult: { id: string; success: boolean; error?: string } | null;
  onToggle: (enabled: boolean) => void;
  onUpdate: (updates: Partial<ProviderConfig>) => void;
  onTest: () => void;
  mode: 'transcription' | 'post-processing';
}

function ProviderCard({ provider, config, isTesting, testResult, onToggle, onUpdate, onTest, mode }: ProviderCardProps) {
  const isEnabled = mode === 'transcription'
    ? (config.enabledForTranscription ?? config.enabled)
    : (config.enabledForPostProcessing ?? config.enabled);

  return (
    <Card glass padding="md">
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        marginBottom: isEnabled ? 'var(--space-4)' : 0,
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: '4px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text-primary)', margin: 0 }}>
              {provider.name}
            </h3>
            {config.hasKeyInKeychain && (
              <Badge variant={testResult?.success ? 'success' : 'warning'}>
                {testResult?.success ? 'Connected' : 'Configured'}
              </Badge>
            )}
          </div>
          <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', margin: 0 }}>
            {provider.description}
          </p>
        </div>

        <button
          onClick={() => onToggle(!isEnabled)}
          style={{
            padding: '6px 14px',
            borderRadius: '6px',
            border: isEnabled ? '1px solid #22c55e' : '1px solid #333',
            background: isEnabled ? 'rgba(34, 197, 94, 0.1)' : '#222',
            color: isEnabled ? '#22c55e' : '#666',
            fontSize: '13px',
            fontWeight: 500,
            cursor: 'pointer',
            marginLeft: 'var(--space-4)',
            flexShrink: 0,
          }}
        >
          {isEnabled ? 'Enabled' : 'Disabled'}
        </button>
      </div>

      {isEnabled && (
        <div style={{
          paddingTop: 'var(--space-4)',
          borderTop: '1px solid var(--color-border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-3)',
        }}>
          {provider.requireApiKey && provider.id !== 'aliyun-asr' && (
            <Input
              type="password"
              label="API Key"
              value={config.apiKey || ''}
              onChange={(e) => onUpdate({ apiKey: e.target.value })}
              placeholder={`${provider.name} API key`}
            />
          )}

          {provider.id === 'aliyun-asr' && (
            <AliyunCredentialInputs providerId={provider.id} config={config} onUpdate={onUpdate as any} />
          )}

          {provider.supportedModels.length > 1 && (
            <Select
              label="Model"
              options={provider.supportedModels.map(m => ({ value: m, label: m }))}
              value={config.model || provider.defaultModel || provider.supportedModels[0]}
              onChange={(e) => onUpdate({ model: e.target.value })}
            />
          )}

          {provider.defaultBaseUrl && (
            <Input
              type="text"
              label="Base URL"
              value={config.baseUrl || provider.defaultBaseUrl}
              onChange={(e) => onUpdate({ baseUrl: e.target.value })}
            />
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginTop: 'var(--space-1)' }}>
            <Button variant="secondary" size="sm" onClick={onTest} disabled={isTesting}>
              <Zap size={13} />
              {isTesting ? 'Testing...' : 'Test Connection'}
            </Button>

            {testResult && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '13px',
                color: testResult.success ? '#22c55e' : '#ef4444',
              }}>
                {testResult.success ? (
                  <><Check size={14} /> Connected</>
                ) : (
                  <><AlertCircle size={14} /> {testResult.error}</>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

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
      setAccessKeyId('');
      setAccessKeySecret('');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      <Input
        type="password"
        label="AccessKey ID"
        value={accessKeyId}
        onChange={(e) => setAccessKeyId(e.target.value)}
        placeholder="Enter Alibaba Cloud AccessKey ID"
      />
      <Input
        type="password"
        label="AccessKey Secret"
        value={accessKeySecret}
        onChange={(e) => setAccessKeySecret(e.target.value)}
        placeholder="Enter Alibaba Cloud AccessKey Secret"
      />
      {config.hasKeyInKeychain && (
        <p style={{ fontSize: '12px', color: '#22c55e', margin: 0 }}>Credentials saved in secure storage</p>
      )}
      <Button
        variant="primary"
        size="sm"
        onClick={handleSave}
        disabled={!accessKeyId || !accessKeySecret}
      >
        Save Credentials
      </Button>
    </div>
  );
}
