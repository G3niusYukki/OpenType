import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, AlertCircle, Loader2 } from 'lucide-react';

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
    recommendations: string[];
  };
}

interface StatusItemProps {
  label: string;
  status: 'ready' | 'missing' | 'optional' | 'loading';
  detail?: string;
}

function StatusItem({ label, status, detail }: StatusItemProps) {
  const getIcon = () => {
    switch (status) {
      case 'ready':
        return <CheckCircle size={14} color="#22c55e" />;
      case 'missing':
        return <XCircle size={14} color="#ef4444" />;
      case 'optional':
        return <AlertCircle size={14} color="#f59e0b" />;
      case 'loading':
        return <Loader2 size={14} color="#666" className="animate-spin" />;
    }
  };

  const getColor = () => {
    switch (status) {
      case 'ready':
        return '#22c55e';
      case 'missing':
        return '#ef4444';
      case 'optional':
        return '#f59e0b';
      case 'loading':
        return '#666';
    }
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '8px 12px',
      background: 'rgba(0,0,0,0.3)',
      borderRadius: '6px',
      fontSize: '12px',
    }}>
      {getIcon()}
      <span style={{ color: getColor(), fontWeight: 500 }}>
        {label}
      </span>
      {detail && (
        <span style={{ color: '#666', marginLeft: 'auto' }}>
          {detail}
        </span>
      )}
    </div>
  );
}

export function SystemStatusPanel() {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    loadStatus();
    // Refresh status every 30 seconds
    const interval = setInterval(loadStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadStatus = async () => {
    try {
      const systemStatus = await window.electronAPI.systemGetStatus();
      setStatus(systemStatus);
    } catch (error) {
      console.error('Failed to load system status:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{
        padding: '12px',
        background: '#1a1a1a',
        borderRadius: '8px',
        border: '1px solid #2a2a2a',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          color: '#666',
          fontSize: '13px',
        }}>
          <Loader2 size={14} className="animate-spin" />
          Checking system status...
        </div>
      </div>
    );
  }

  if (!status) return null;

  const { audio, transcription } = status;
  
  // Determine overall status
  const canRecord = audio.ffmpegAvailable && audio.hasAudioDevices;
  const canTranscribe = (transcription.whisperInstalled && transcription.modelAvailable) || 
                        transcription.hasCloudProvider;
  
  const isFullyReady = canRecord && canTranscribe;
  const needsSetup = !isFullyReady;

  if (!expanded && isFullyReady) {
    // Compact view when everything is ready
    return (
      <div 
        onClick={() => setExpanded(true)}
        style={{
          padding: '8px 12px',
          background: 'rgba(34, 197, 94, 0.1)',
          borderRadius: '8px',
          border: '1px solid rgba(34, 197, 94, 0.2)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '12px',
          color: '#22c55e',
        }}
      >
        <CheckCircle size={14} />
        <span>System ready — {transcription.activeProvider === 'whisper.cpp' ? 'Local' : 'Cloud'} transcription active</span>
      </div>
    );
  }

  return (
    <div style={{
      background: '#1a1a1a',
      borderRadius: '8px',
      border: `1px solid ${needsSetup ? 'rgba(239, 68, 68, 0.3)' : '#2a2a2a'}`,
      overflow: 'hidden',
    }}>
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          padding: '12px 16px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: needsSetup ? 'rgba(239, 68, 68, 0.05)' : 'transparent',
        }}
      >
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '13px',
          fontWeight: 500,
        }}>
          {needsSetup ? (
            <>
              <AlertCircle size={16} color="#ef4444" />
              <span style={{ color: '#ef4444' }}>Setup Required</span>
            </>
          ) : (
            <>
              <CheckCircle size={16} color="#22c55e" />
              <span style={{ color: '#22c55e' }}>System Ready</span>
            </>
          )}
        </div>
        <span style={{ fontSize: '11px', color: '#666' }}>
          {expanded ? 'Click to collapse' : 'Click to expand'}
        </span>
      </div>

      {expanded && (
        <div style={{ padding: '12px 16px 16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Audio Section */}
          <div>
            <p style={{
              fontSize: '11px',
              color: '#666',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: '8px',
            }}>
              Audio Recording
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <StatusItem
                label="ffmpeg"
                status={audio.ffmpegAvailable ? 'ready' : 'missing'}
                detail={audio.ffmpegAvailable ? 'Installed' : 'Not found'}
              />
              <StatusItem
                label="Microphone"
                status={audio.hasAudioDevices ? 'ready' : 'missing'}
                detail={audio.hasAudioDevices ? `${audio.deviceCount} device(s)` : 'No devices'}
              />
            </div>
            {!audio.ffmpegAvailable && (
              <div style={{
                marginTop: '8px',
                padding: '8px 12px',
                background: 'rgba(239, 68, 68, 0.1)',
                borderRadius: '6px',
                fontSize: '11px',
                color: '#ef4444',
                lineHeight: 1.5,
              }}>
                <strong>ffmpeg is required for audio recording.</strong><br />
                Install with: <code style={{ background: 'rgba(0,0,0,0.3)', padding: '2px 4px', borderRadius: '3px' }}>brew install ffmpeg</code>
              </div>
            )}
          </div>

          {/* Transcription Section */}
          <div>
            <p style={{
              fontSize: '11px',
              color: '#666',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: '8px',
            }}>
              Transcription
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <StatusItem
                label="whisper.cpp"
                status={transcription.whisperInstalled ? 'ready' : transcription.hasCloudProvider ? 'optional' : 'missing'}
                detail={transcription.whisperInstalled ? 'Installed' : 'Not found'}
              />
              <StatusItem
                label="Model file"
                status={transcription.modelAvailable ? 'ready' : transcription.hasCloudProvider ? 'optional' : 'missing'}
                detail={transcription.modelAvailable ? 'Found' : 'Not found'}
              />
              <StatusItem
                label="Cloud provider"
                status={transcription.hasCloudProvider ? 'ready' : 'optional'}
                detail={transcription.hasCloudProvider ? 'Configured' : 'Not configured'}
              />
            </div>
            
            {transcription.recommendations.length > 0 && (
              <div style={{
                marginTop: '8px',
                padding: '10px 12px',
                background: transcription.hasCloudProvider ? 'rgba(245, 158, 11, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                borderRadius: '6px',
                fontSize: '11px',
                color: transcription.hasCloudProvider ? '#f59e0b' : '#ef4444',
                lineHeight: 1.5,
              }}
              >
                {transcription.recommendations.map((rec, i) => (
                  <div key={i} style={{ marginBottom: i < transcription.recommendations.length - 1 ? '4px' : 0 }}>
                    {rec.startsWith('  ') ? (
                      <code style={{ 
                        background: 'rgba(0,0,0,0.3)', 
                        padding: '2px 6px', 
                        borderRadius: '3px',
                        fontSize: '10px',
                        display: 'inline-block',
                        marginTop: '2px'
                      }}>
                        {rec.trim()}
                      </code>
                    ) : rec}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Active Provider */}
          {transcription.activeProvider && (
            <div style={{
              padding: '10px 12px',
              background: 'rgba(34, 197, 94, 0.1)',
              borderRadius: '6px',
              fontSize: '12px',
              color: '#22c55e',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
            >
              <CheckCircle size={14} />
              <span><strong>Active:</strong> {transcription.activeProvider === 'whisper.cpp' ? 'Local transcription (whisper.cpp)' : 'Cloud transcription (OpenAI)'}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
