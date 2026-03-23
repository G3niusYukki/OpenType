import { useState, useEffect } from 'react';
import { Card, Button, Badge } from '../../components/ui';
import { useUpdate } from '../../contexts/UpdateContext';

export function SettingsData() {
  const [localModels, setLocalModels] = useState<Array<{ name: string; path: string; size: number; exists: boolean }>>([]);
  const [deletingModel, setDeletingModel] = useState<string | null>(null);
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
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const models = await window.electronAPI.modelsList();
      setLocalModels(models);
    } catch {}
    loadStorageStats();
  };

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Version & Updates */}
      <UpdateSettings />

      {/* Local Models */}
      <section>
        <h2 className="section-title">Local Models</h2>
        <Card glass padding="lg">
          <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: 'var(--space-4)', marginTop: 0 }}>
            Manage locally downloaded whisper.cpp transcription models.
          </p>

          {localModels.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 'var(--space-6)', color: '#444', fontSize: '13px' }}>
              <p style={{ margin: '0 0 8px 0' }}>No local whisper.cpp models found</p>
              <p style={{ margin: 0, color: '#333' }}>
                Download models from{' '}
                <a href="https://huggingface.co/ggerganov/whisper.cpp" target="_blank" rel="noopener" style={{ color: 'var(--color-accent)' }}>
                  huggingface.co/ggerganov/whisper.cpp
                </a>
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              {localModels.map(model => (
                <div key={model.path} style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  background: 'rgba(0,0,0,0.2)',
                  borderRadius: '8px',
                }}>
                  <div>
                    <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: '0 0 2px 0', fontFamily: 'monospace' }}>{model.name}</p>
                    <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', margin: 0 }}>{model.path}</p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                    <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>{formatBytes(model.size)}</span>
                    <Button
                      variant="secondary"
                      size="sm"
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
                    >
                      {deletingModel === model.path ? 'Deleting...' : 'Delete'}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: 'var(--space-3)', marginBottom: 0 }}>
            Model files are stored in <code style={{ color: 'var(--color-text-muted)' }}>~/Library/Application Support/OpenType/models/</code>
          </p>
        </Card>
      </section>

      {/* Storage Usage */}
      <section>
        <h2 className="section-title">Storage Usage</h2>
        <Card glass padding="lg">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
            <StatCard label="History Items" value={storageStats.historyCount.toString()} />
            <StatCard label="Dictionary Entries" value={storageStats.dictionaryCount.toString()} />
            <StatCard label="Temp Files" value={storageStats.tempFilesCount.toString()} />
            <StatCard label="Temp Storage" value={formatBytes(storageStats.tempFilesSize)} />
          </div>
          <Button variant="secondary" size="sm" onClick={loadStorageStats} disabled={isLoading}>
            Refresh
          </Button>
        </Card>
      </section>

      {/* Export Data */}
      <section>
        <h2 className="section-title">Export Data</h2>
        <Card glass padding="lg">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
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
              marginTop: 'var(--space-3)',
              fontSize: '13px',
              color: exportStatus.includes('failed') || exportStatus.includes('error') ? '#ef4444' : '#22c55e',
            }}>
              {exportStatus}
            </p>
          )}
        </Card>
      </section>

      {/* Cleanup */}
      <section>
        <h2 className="section-title">Data Cleanup</h2>
        <Card glass padding="lg">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
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
        </Card>
      </section>

      {/* Confirmation Dialog */}
      {showConfirmDialog && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
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
            <h3 style={{ fontSize: '18px', fontWeight: 600, color: showConfirmDialog === 'clear-all' ? '#ef4444' : '#fff', margin: '0 0 12px 0' }}>
              {showConfirmDialog === 'clear-history' && 'Clear History?'}
              {showConfirmDialog === 'clear-cache' && 'Clear Cache?'}
              {showConfirmDialog === 'clear-all' && 'Clear All Data?'}
            </h3>
            <p style={{ fontSize: '14px', color: '#888', margin: '0 0 16px 0', lineHeight: 1.5 }}>
              {showConfirmDialog === 'clear-history' && 'This will permanently delete all transcription history and associated audio files. This action cannot be undone.'}
              {showConfirmDialog === 'clear-cache' && `This will delete ${storageStats.tempFilesCount} temporary files (${formatBytes(storageStats.tempFilesSize)}).`}
              {showConfirmDialog === 'clear-all' && 'This will delete ALL data including history, dictionary, and reset all settings to defaults. API keys in secure storage will be preserved. This action cannot be undone.'}
            </p>
            {(showConfirmDialog === 'clear-history' || showConfirmDialog === 'clear-all') && (
              <div style={{ marginBottom: '16px' }}>
                <p style={{ fontSize: '13px', color: '#666', margin: '0 0 8px 0' }}>
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
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            )}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <Button variant="secondary" size="sm" onClick={() => { setShowConfirmDialog(null); setConfirmText(''); }}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
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
                style={{ background: showConfirmDialog === 'clear-all' ? '#ef4444' : undefined }}
              >
                {isLoading ? 'Processing...' : 'Confirm'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function UpdateSettings() {
  const { updateInfo, isChecking, checkUpdate } = useUpdate();
  const [appVersion, setAppVersion] = useState<string | null>(null);

  useEffect(() => {
    window.electronAPI.appVersion().then((v: string) => setAppVersion(v));
  }, []);

  return (
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
          <span>v{updateInfo?.version ?? appVersion ?? '...'}</span>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
        <Badge variant="success">Auto-update enabled</Badge>
        <Button variant="primary" size="sm" onClick={() => checkUpdate()} disabled={isChecking}>
          {isChecking ? 'Checking...' : 'Check for Updates'}
        </Button>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: '#1a1a1a', borderRadius: '8px', padding: '16px', textAlign: 'center' }}>
      <p style={{ fontSize: '24px', fontWeight: 600, color: '#fff', margin: '0 0 4px 0' }}>{value}</p>
      <p style={{ fontSize: '12px', color: '#666', margin: 0 }}>{label}</p>
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
      background: 'rgba(0,0,0,0.2)',
      borderRadius: '8px',
    }}>
      <div>
        <p style={{ fontSize: '14px', fontWeight: 500, color: 'var(--color-text-secondary)', margin: '0 0 4px 0' }}>{label}</p>
        <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', margin: 0 }}>{description}</p>
      </div>
      <div style={{ display: 'flex', gap: '8px' }}>
        <Button variant="primary" size="sm" onClick={onExportJSON} disabled={disabled}>Export JSON</Button>
        {!hideCSV && onExportCSV && (
          <Button variant="secondary" size="sm" onClick={onExportCSV} disabled={disabled}>Export CSV</Button>
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
      background: 'rgba(0,0,0,0.2)',
      borderRadius: '8px',
    }}>
      <div>
        <p style={{ fontSize: '14px', fontWeight: 500, color: danger ? '#ef4444' : 'var(--color-text-secondary)', margin: '0 0 4px 0' }}>{label}</p>
        <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', margin: 0 }}>{description}</p>
      </div>
      <Button
        variant={danger ? 'primary' : 'secondary'}
        size="sm"
        onClick={onClick}
        disabled={disabled}
        style={danger ? { background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', color: '#ef4444' } : {}}
      >
        {label}
      </Button>
    </div>
  );
}
