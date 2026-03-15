import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, AlertCircle, Loader2, ExternalLink, RefreshCw } from 'lucide-react';

interface DiagnosticsResult {
  microphone: { status: string; message: string };
  accessibility: { status: string; message: string };
  automation: { status: string; message: string };
  ffmpeg: { status: string; version?: string; message: string };
  whisper: { status: string; path?: string; message: string };
  model: { status: string; path?: string; size?: number; message: string };
  transcriptionProvider: { status: string; provider: string; message: string };
}

interface StatusRowProps {
  label: string;
  status: 'ok' | 'error' | 'warning' | 'loading';
  message: string;
  onFix?: () => void;
  fixLabel?: string;
}

function StatusRow({ label, status, message, onFix, fixLabel }: StatusRowProps) {
  const getIcon = () => {
    switch (status) {
      case 'ok':
        return <CheckCircle size={16} color="#22c55e" />;
      case 'error':
        return <XCircle size={16} color="#ef4444" />;
      case 'warning':
        return <AlertCircle size={16} color="#f59e0b" />;
      case 'loading':
        return <Loader2 size={16} color="#666" className="animate-spin" />;
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'ok':
        return '#22c55e';
      case 'error':
        return '#ef4444';
      case 'warning':
        return '#f59e0b';
      case 'loading':
        return '#666';
    }
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      padding: '12px 16px',
      background: 'rgba(0,0,0,0.2)',
      borderRadius: '8px',
      fontSize: '13px',
    }}>
      {getIcon()}
      <div style={{ flex: 1 }}>
        <div style={{ 
          fontWeight: 500, 
          color: getStatusColor(),
          marginBottom: '2px'
        }}>
          {label}
        </div>
        <div style={{ color: '#888', fontSize: '12px' }}>
          {message}
        </div>
      </div>
      {onFix && status !== 'ok' && (
        <button
          onClick={onFix}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '6px 12px',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '6px',
            color: '#ef4444',
            fontSize: '12px',
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          <ExternalLink size={12} />
          {fixLabel || 'Fix'}
        </button>
      )}
    </div>
  );
}

interface DiagnosticsPanelProps {
  compact?: boolean;
}

export function DiagnosticsPanel({ compact = false }: DiagnosticsPanelProps) {
  const [diagnostics, setDiagnostics] = useState<DiagnosticsResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    runDiagnostics();
  }, []);

  const runDiagnostics = async () => {
    try {
      const result = await window.electronAPI.diagnosticsRun();
      setDiagnostics(result);
    } catch (error) {
      console.error('Failed to run diagnostics:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    runDiagnostics();
  };

  const handleOpenSettings = (permissionType: 'microphone' | 'accessibility' | 'automation') => {
    window.electronAPI.diagnosticsOpenSettings(permissionType);
  };

  const getStatus = (status: string): 'ok' | 'error' | 'warning' => {
    if (status === 'granted' || status === 'ok') return 'ok';
    if (status === 'denied' || status === 'missing' || status === 'error') return 'error';
    return 'warning';
  };

  if (loading) {
    return (
      <div style={{
        padding: '24px',
        background: '#161616',
        border: '1px solid #222',
        borderRadius: '12px',
        textAlign: 'center',
        color: '#666',
      }}>
        <Loader2 size={24} className="animate-spin" style={{ marginBottom: '12px' }} />
        <div>Running diagnostics...</div>
      </div>
    );
  }

  if (!diagnostics) {
    return (
      <div style={{
        padding: '24px',
        background: '#161616',
        border: '1px solid #222',
        borderRadius: '12px',
        textAlign: 'center',
        color: '#ef4444',
      }}>
        Failed to run diagnostics
      </div>
    );
  }

  const allOk = 
    getStatus(diagnostics.microphone.status) === 'ok' &&
    getStatus(diagnostics.accessibility.status) === 'ok' &&
    getStatus(diagnostics.automation.status) === 'ok' &&
    getStatus(diagnostics.ffmpeg.status) === 'ok';

  if (compact) {
    return (
      <div style={{
        padding: '12px 16px',
        background: allOk ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
        border: `1px solid ${allOk ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
        borderRadius: '8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          color: allOk ? '#22c55e' : '#ef4444',
          fontSize: '13px',
          fontWeight: 500,
        }}>
          {allOk ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
          {allOk ? 'All systems operational' : 'Some checks failed'}
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '4px 8px',
            background: 'transparent',
            border: '1px solid #333',
            borderRadius: '4px',
            color: '#666',
            fontSize: '11px',
            cursor: 'pointer',
          }}
        >
          <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>
    );
  }

  return (
    <div style={{
      background: '#161616',
      border: '1px solid #222',
      borderRadius: '12px',
      overflow: 'hidden',
    }}>
      <div style={{
        padding: '16px 20px',
        borderBottom: '1px solid #222',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <h3 style={{
          margin: 0,
          fontSize: '14px',
          fontWeight: 600,
          color: '#fff',
        }}>
          System Diagnostics
        </h3>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 12px',
            background: 'transparent',
            border: '1px solid #333',
            borderRadius: '6px',
            color: '#666',
            fontSize: '12px',
            cursor: 'pointer',
          }}
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          {refreshing ? 'Checking...' : 'Refresh'}
        </button>
      </div>

      <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{
          fontSize: '11px',
          color: '#666',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          marginBottom: '4px',
        }}>
          Permissions
        </div>
        
        <StatusRow
          label="Microphone"
          status={getStatus(diagnostics.microphone.status)}
          message={diagnostics.microphone.message}
          onFix={() => handleOpenSettings('microphone')}
          fixLabel="Open Settings"
        />
        
        <StatusRow
          label="Accessibility"
          status={getStatus(diagnostics.accessibility.status)}
          message={diagnostics.accessibility.message}
          onFix={() => handleOpenSettings('accessibility')}
          fixLabel="Open Settings"
        />
        
        <StatusRow
          label="Automation"
          status={getStatus(diagnostics.automation.status)}
          message={diagnostics.automation.message}
          onFix={() => handleOpenSettings('automation')}
          fixLabel="Open Settings"
        />

        <div style={{
          fontSize: '11px',
          color: '#666',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          marginTop: '8px',
          marginBottom: '4px',
        }}>
          Dependencies
        </div>

        <StatusRow
          label="ffmpeg"
          status={getStatus(diagnostics.ffmpeg.status)}
          message={diagnostics.ffmpeg.message}
        />
        
        <StatusRow
          label="whisper.cpp"
          status={getStatus(diagnostics.whisper.status)}
          message={diagnostics.whisper.message}
        />
        
        <StatusRow
          label="Whisper Model"
          status={getStatus(diagnostics.model.status)}
          message={diagnostics.model.message}
        />

        {allOk && (
          <div style={{
            marginTop: '8px',
            padding: '12px 16px',
            background: 'rgba(34, 197, 94, 0.1)',
            border: '1px solid rgba(34, 197, 94, 0.2)',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            color: '#22c55e',
            fontSize: '13px',
            fontWeight: 500,
          }}>
            <CheckCircle size={16} />
            All diagnostics passed — Ready to transcribe
          </div>
        )}
      </div>
    </div>
  );
}
