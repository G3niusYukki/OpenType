import { useState, useEffect, useCallback } from 'react';
import { Mic, Square, Copy, Type, AlertCircle, CheckCircle } from 'lucide-react';
import { SystemStatusPanel } from '../components/SystemStatusPanel';

interface TranscriptionResult {
  text: string;
  success: boolean;
  provider: string;
  error?: string;
  fallbackToClipboard?: boolean;
}

export function HomePage() {
  const [isRecording, setIsRecording] = useState(false);
  const [lastTranscription, setLastTranscription] = useState('');
  const [lastResult, setLastResult] = useState<TranscriptionResult | null>(null);
  const [hotkey, setHotkey] = useState('⌘⇧D');
  const [insertionStatus, setInsertionStatus] = useState<{
    method: 'paste' | 'clipboard' | 'type' | 'failed';
    accessibilityRequired?: boolean;
  } | null>(null);

  useEffect(() => {
    // Load hotkey on mount
    window.electronAPI.storeGet('hotkey').then((key: unknown) => {
      if (key) setHotkey(formatHotkey(key as string));
    });

    // Subscribe to recording events
    const unsubStart = window.electronAPI.onRecordingStarted(() => {
      setIsRecording(true);
      setInsertionStatus(null);
    });

    const unsubStop = window.electronAPI.onRecordingStopped(() => {
      setIsRecording(false);
    });

    const unsubTranscription = window.electronAPI.onTranscriptionComplete((result) => {
      setLastTranscription(result.text);
      setLastResult(result);
      
      // Track if text insertion fell back to clipboard
      if (result.fallbackToClipboard) {
        setInsertionStatus({ method: 'clipboard' });
      }
    });

    return () => {
      unsubStart();
      unsubStop();
      unsubTranscription();
    };
  }, []);

  const formatHotkey = (key: string): string => {
    return key
      .replace('CommandOrControl+', '⌘')
      .replace('Control+', '⌃')
      .replace('Alt+', '⌥')
      .replace('Shift+', '⇧')
      .replace('Command', '⌘');
  };

  const toggleRecording = useCallback(async () => {
    if (isRecording) {
      await window.electronAPI.recordingStop();
    } else {
      setLastResult(null);
      setInsertionStatus(null);
      await window.electronAPI.recordingStart();
    }
  }, [isRecording]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(lastTranscription);
    setInsertionStatus({ method: 'clipboard' });
    setTimeout(() => setInsertionStatus(null), 2000);
  };

  const handleInsert = async () => {
    const result = await window.electronAPI.textInsert(lastTranscription);
    setInsertionStatus({
      method: result.method,
      accessibilityRequired: result.accessibilityRequired
    });
    
    // Clear status after 3 seconds unless accessibility is required
    if (!result.accessibilityRequired) {
      setTimeout(() => setInsertionStatus(null), 3000);
    }
  };

  const hasError = lastResult && !lastResult.success;
  const showFallbackWarning = insertionStatus?.method === 'clipboard' || lastResult?.fallbackToClipboard;

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      padding: '32px',
      background: 'linear-gradient(180deg, #0f0f0f 0%, #13131f 100%)',
      overflow: 'auto',
    }}>
      {/* System Status Panel */}
      <div style={{ marginBottom: '24px' }}>
        <SystemStatusPanel />
      </div>

      {/* Main Content - Recording Button */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '300px',
      }}>
        {/* Recording Button */}
        <button
          onClick={toggleRecording}
          style={{
            width: '140px',
            height: '140px',
            borderRadius: '50%',
            border: 'none',
            background: isRecording
              ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
              : 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: isRecording
              ? '0 0 40px rgba(239, 68, 68, 0.4)'
              : '0 0 40px rgba(99, 102, 241, 0.3)',
            transition: 'all 0.3s ease',
            transform: isRecording ? 'scale(0.95)' : 'scale(1)',
          }}
          onMouseEnter={(e) => {
            if (!isRecording) {
              e.currentTarget.style.transform = 'scale(1.05)';
              e.currentTarget.style.boxShadow = '0 0 60px rgba(99, 102, 241, 0.4)';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = isRecording ? 'scale(0.95)' : 'scale(1)';
            e.currentTarget.style.boxShadow = isRecording
              ? '0 0 40px rgba(239, 68, 68, 0.4)'
              : '0 0 40px rgba(99, 102, 241, 0.3)';
          }}
        >
          {isRecording ? (
            <Square size={48} color="white" fill="white" />
          ) : (
            <Mic size={56} color="white" />
          )}
        </button>

        <p style={{
          marginTop: '24px',
          fontSize: '16px',
          color: isRecording ? '#ef4444' : '#818cf8',
          fontWeight: 500,
        }}>
          {isRecording ? 'Recording...' : `Press ${hotkey} to start`}
        </p>

        {/* Permission/Error Messages */}
        {insertionStatus?.accessibilityRequired && (
          <div style={{
            marginTop: '16px',
            padding: '12px 16px',
            background: 'rgba(245, 158, 11, 0.1)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            borderRadius: '8px',
            maxWidth: '400px',
            textAlign: 'center',
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              color: '#f59e0b',
              fontSize: '13px',
              marginBottom: '8px',
            }}>
              <AlertCircle size={16} />
              <strong>Accessibility Permission Required</strong>
            </div>
            <p style={{
              fontSize: '12px',
              color: '#888',
              margin: 0,
              lineHeight: 1.5,
            }}>
              OpenType needs Accessibility permission to paste text at your cursor.
              Text has been copied to clipboard instead.
            </p>
            <button
              onClick={() => window.electronAPI.windowShow()}
              style={{
                marginTop: '10px',
                padding: '6px 12px',
                background: 'rgba(245, 158, 11, 0.2)',
                border: '1px solid rgba(245, 158, 11, 0.4)',
                borderRadius: '4px',
                color: '#f59e0b',
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              Open Settings → Privacy & Security → Accessibility
            </button>
          </div>
        )}
      </div>

      {/* Transcription Result */}
      {lastTranscription && (
        <div style={{
          width: '100%',
          maxWidth: '600px',
          margin: '0 auto 32px',
        }}>
          <p style={{
            fontSize: '12px',
            color: '#666',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            marginBottom: '12px',
          }}>
            Last Transcription
            {lastResult?.provider && lastResult.provider !== 'none' && (
              <span style={{ color: '#444', marginLeft: '8px' }}>
                via {lastResult.provider}
              </span>
            )}
          </p>
          
          <div style={{
            background: '#1a1a1a',
            border: `1px solid ${hasError ? 'rgba(239, 68, 68, 0.3)' : '#2a2a2a'}`,
            borderRadius: '12px',
            padding: '20px',
          }}>
            <p style={{
              fontSize: '16px',
              lineHeight: 1.6,
              color: hasError ? '#ef4444' : '#e5e5e5',
              margin: 0,
              minHeight: '24px',
            }}>
              {lastTranscription}
            </p>

            {/* Fallback Warning */}
            {showFallbackWarning && !hasError && (
              <div style={{
                marginTop: '12px',
                padding: '8px 12px',
                background: 'rgba(245, 158, 11, 0.1)',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '12px',
                color: '#f59e0b',
              }}
              >
                <AlertCircle size={14} />
                <span>Text copied to clipboard (auto-insert unavailable)</span>
              </div>
            )}

            <div style={{
              display: 'flex',
              gap: '8px',
              marginTop: '16px',
              paddingTop: '16px',
              borderTop: '1px solid #2a2a2a',
            }}>
              <button
                onClick={handleCopy}
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
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#2a2a2a';
                  e.currentTarget.style.color = '#ccc';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#222';
                  e.currentTarget.style.color = '#999';
                }}
              >
                {insertionStatus?.method === 'clipboard' ? (
                  <><CheckCircle size={14} /> Copied!</>
                ) : (
                  <><Copy size={14} /> Copy</>
                )}
              </button>

              <button
                onClick={handleInsert}
                disabled={insertionStatus?.accessibilityRequired}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 14px',
                  borderRadius: '6px',
                  border: '1px solid #6366f1',
                  background: insertionStatus?.method === 'paste' 
                    ? 'rgba(34, 197, 94, 0.2)' 
                    : 'rgba(99, 102, 241, 0.1)',
                  color: insertionStatus?.method === 'paste' ? '#22c55e' : '#818cf8',
                  fontSize: '13px',
                  cursor: insertionStatus?.accessibilityRequired ? 'not-allowed' : 'pointer',
                  opacity: insertionStatus?.accessibilityRequired ? 0.5 : 1,
                }}
                onMouseEnter={(e) => {
                  if (!insertionStatus?.accessibilityRequired) {
                    e.currentTarget.style.background = insertionStatus?.method === 'paste'
                      ? 'rgba(34, 197, 94, 0.3)'
                      : 'rgba(99, 102, 241, 0.2)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = insertionStatus?.method === 'paste'
                    ? 'rgba(34, 197, 94, 0.2)'
                    : 'rgba(99, 102, 241, 0.1)';
                }}
              >
                {insertionStatus?.method === 'paste' ? (
                  <><CheckCircle size={14} /> Inserted!</>
                ) : (
                  <><Type size={14} /> Insert at Cursor</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!lastTranscription && !isRecording && (
        <div style={{
          textAlign: 'center',
          color: '#444',
          marginBottom: '48px',
        }}>
          <p style={{ fontSize: '14px', marginBottom: '8px' }}>
            Your transcriptions will appear here
          </p>
          <p style={{ fontSize: '12px', color: '#333' }}>
            Click the mic or press {hotkey} to start dictating
          </p>
        </div>
      )}
    </div>
  );
}
