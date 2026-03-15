import { useState, useEffect } from 'react';
import { Activity, AlertCircle, CheckCircle, Clock, RefreshCw } from 'lucide-react';
import { DiagnosticsPanel } from '../components/DiagnosticsPanel';

interface FailureRecord {
  timestamp: number;
  error: string;
  context: string;
}

export function DiagnosticsPage() {
  const [lastFailure, setLastFailure] = useState<FailureRecord | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLastFailure();
  }, []);

  const loadLastFailure = async () => {
    try {
      const failure = await window.electronAPI.diagnosticsGetLastFailure();
      setLastFailure(failure);
    } catch (error) {
      console.error('Failed to load last failure:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatTimestamp = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: '32px' }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '32px',
      }}>
        <div>
          <h1 style={{
            fontSize: '24px',
            fontWeight: 600,
            color: '#fff',
            margin: '0 0 8px 0',
          }}>
            Diagnostics
          </h1>
          <p style={{
            fontSize: '14px',
            color: '#666',
            margin: 0,
          }}>
            Check system health and permissions
          </p>
        </div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 16px',
          background: 'rgba(99, 102, 241, 0.1)',
          borderRadius: '8px',
          color: '#6366f1',
          fontSize: '13px',
        }}>
          <Activity size={16} />
          System Status
        </div>
      </div>

      <DiagnosticsPanel />

      {lastFailure && (
        <div style={{
          marginTop: '24px',
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
            gap: '12px',
          }}>
            <AlertCircle size={18} color="#f59e0b" />
            <h3 style={{
              margin: 0,
              fontSize: '14px',
              fontWeight: 600,
              color: '#fff',
            }}>
              Last Error
            </h3>
          </div>

          <div style={{ padding: '20px' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '12px',
              color: '#888',
              fontSize: '13px',
            }}>
              <Clock size={14} />
              {formatTimestamp(lastFailure.timestamp)}
            </div>

            <div style={{
              padding: '12px 16px',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              borderRadius: '8px',
              color: '#ef4444',
              fontSize: '13px',
              fontFamily: 'monospace',
              marginBottom: '12px',
            }}>
              {lastFailure.error}
            </div>

            <div style={{
              fontSize: '12px',
              color: '#666',
            }}>
              <strong>Context:</strong> {lastFailure.context}
            </div>
          </div>
        </div>
      )}

      {!lastFailure && !loading && (
        <div style={{
          marginTop: '24px',
          padding: '24px',
          background: 'rgba(34, 197, 94, 0.05)',
          border: '1px solid rgba(34, 197, 94, 0.1)',
          borderRadius: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          color: '#22c55e',
          fontSize: '14px',
        }}>
          <CheckCircle size={20} />
          <div>
            <div style={{ fontWeight: 500 }}>No recent errors</div>
            <div style={{ fontSize: '12px', color: '#22c55e', opacity: 0.8 }}>
              Everything is running smoothly
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
