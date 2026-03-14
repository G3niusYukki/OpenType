import { useState, useEffect, useCallback, useRef } from 'react';
import { Mic, Square, Copy, Type, AlertCircle, CheckCircle, Activity, Sparkles, FileText } from 'lucide-react';
import { SystemStatusPanel } from '../components/SystemStatusPanel';
import { useI18n } from '../i18n';

interface TextChange {
  type: 'filler' | 'repetition' | 'correction' | 'improvement';
  original: string;
  replacement: string;
  position: number;
  explanation?: string;
}

interface TranscriptionResult {
  text: string;
  rawText?: string;
  processedText?: string;
  success: boolean;
  provider: string;
  aiProcessed?: boolean;
  aiChanges?: TextChange[];
  aiLatency?: number;
  aiProvider?: string;
  error?: string;
  fallbackToClipboard?: boolean;
}

// Audio waveform visualization component
function AudioWaveform({ isRecording }: { isRecording: boolean }) {
  const bars = 12;
  
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '4px',
      height: '60px',
      opacity: isRecording ? 1 : 0.3,
      transition: 'opacity 0.3s ease',
    }}>
      {Array.from({ length: bars }).map((_, i) => (
        <div
          key={i}
          style={{
            width: '4px',
            background: isRecording 
              ? 'linear-gradient(180deg, #ef4444 0%, #f87171 100%)' 
              : 'linear-gradient(180deg, #6366f1 0%, #818cf8 100%)',
            borderRadius: '2px',
            animation: isRecording ? `waveform 0.5s ease-in-out ${i * 0.05}s infinite alternate` : 'none',
            height: isRecording ? '20px' : '8px',
            transition: 'height 0.3s ease',
          }}
        />
      ))}
      <style>{`
        @keyframes waveform {
          0% { height: 8px; opacity: 0.5; }
          100% { height: ${Math.random() * 40 + 20}px; opacity: 1; }
        }
      `}</style>
    </div>
  );
}

// Recording timer component
function RecordingTimer({ isRecording }: { isRecording: boolean }) {
  const [seconds, setSeconds] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isRecording) {
      setSeconds(0);
      intervalRef.current = setInterval(() => {
        setSeconds(s => s + 1);
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setSeconds(0);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isRecording]);

  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (!isRecording) return null;

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '8px 16px',
      background: 'rgba(239, 68, 68, 0.1)',
      border: '1px solid rgba(239, 68, 68, 0.3)',
      borderRadius: '20px',
      marginTop: '16px',
    }}>
      <div style={{
        width: '8px',
        height: '8px',
        background: '#ef4444',
        borderRadius: '50%',
        animation: 'pulse 1s ease-in-out infinite',
      }} />
      <span style={{
        color: '#ef4444',
        fontSize: '14px',
        fontWeight: 600,
        fontFamily: 'monospace',
      }}>
        {formatTime(seconds)}
      </span>
      <Activity size={14} color="#ef4444" />
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.8); }
        }
      `}</style>
    </div>
  );
}

export function HomePage() {
  const { t } = useI18n();
  const [isRecording, setIsRecording] = useState(false);
  const [lastTranscription, setLastTranscription] = useState('');
  const [lastResult, setLastResult] = useState<TranscriptionResult | null>(null);
  const [hotkey, setHotkey] = useState('⌘⇧D');
  const [insertionStatus, setInsertionStatus] = useState<{
    method: 'paste' | 'clipboard' | 'type' | 'failed';
    accessibilityRequired?: boolean;
  } | null>(null);
  const [showRawText, setShowRawText] = useState(false);
  const [aiEnabled, setAiEnabled] = useState(false);

  useEffect(() => {
    window.electronAPI.aiGetSettings().then((settings) => {
      setAiEnabled(settings.enabled);
    });
  }, []);

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

      {/* Main Content - Recording Section */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '300px',
      }}>
        {/* Audio Waveform Visualization */}
        <AudioWaveform isRecording={isRecording} />

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
            marginTop: '20px',
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
          {isRecording ? t.home.recording : t.home.pressToStart.replace('{hotkey}', hotkey)}
        </p>

        {/* Recording Timer */}
        <RecordingTimer isRecording={isRecording} />

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
              <strong>{t.home.accessibilityRequired}</strong>
            </div>
            <p style={{
              fontSize: '12px',
              color: '#888',
              margin: 0,
              lineHeight: 1.5,
            }}>
              {t.home.accessibilityMessage}
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
              {t.home.openSettings}
            </button>
          </div>
        )}
      </div>

      {/* Transcription Result - Enhanced Display */}
      {lastTranscription && (
        <div style={{
          width: '100%',
          maxWidth: '700px',
          margin: '0 auto 32px',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '12px',
          }}>
            <p style={{
              fontSize: '12px',
              color: '#666',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              margin: 0,
            }}>
              {t.home.transcriptionResult}
              {lastResult?.provider && lastResult.provider !== 'none' && (
                <span style={{ color: '#444', marginLeft: '8px' }}>
                  via {lastResult.provider}
                </span>
              )}
              {lastResult?.aiProcessed && (
                <span style={{ color: '#818cf8', marginLeft: '8px' }}>
                  + AI polish
                </span>
              )}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {lastResult?.aiProcessed && (
                <span style={{
                  fontSize: '11px',
                  color: '#818cf8',
                  background: 'rgba(99, 102, 241, 0.1)',
                  padding: '2px 8px',
                  borderRadius: '4px',
                }}>
                  <Sparkles size={10} style={{ marginRight: '4px', display: 'inline' }} />
                  {lastResult.aiLatency}ms
                </span>
              )}
              {lastResult?.success && (
                <span style={{
                  fontSize: '11px',
                  color: '#22c55e',
                  background: 'rgba(34, 197, 94, 0.1)',
                  padding: '2px 8px',
                  borderRadius: '4px',
                }}>
                  ✓ {t.home.success}
                </span>
              )}
            </div>
          </div>

          {lastResult?.aiProcessed && aiEnabled && (
            <div style={{
              display: 'flex',
              gap: '8px',
              marginBottom: '12px',
            }}>
              <button
                onClick={() => setShowRawText(false)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  background: !showRawText ? 'rgba(99, 102, 241, 0.2)' : 'transparent',
                  color: !showRawText ? '#818cf8' : '#666',
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
              >
                <Sparkles size={12} />
                Polished
              </button>
              <button
                onClick={() => setShowRawText(true)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  background: showRawText ? 'rgba(100, 100, 100, 0.2)' : 'transparent',
                  color: showRawText ? '#999' : '#666',
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
              >
                <FileText size={12} />
                Original
              </button>
            </div>
          )}

          <div style={{
            background: 'linear-gradient(135deg, #1a1a1a 0%, #1e1e2e 100%)',
            border: `1px solid ${hasError ? 'rgba(239, 68, 68, 0.3)' : '#2a2a2a'}`,
            borderRadius: '16px',
            padding: '24px',
            boxShadow: '0 4px 24px rgba(0, 0, 0, 0.3)',
          }}>
            <p style={{
              fontSize: '18px',
              lineHeight: 1.8,
              color: hasError ? '#ef4444' : '#e5e5e5',
              margin: 0,
              minHeight: '60px',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}>
              {showRawText && lastResult?.rawText ? lastResult.rawText : lastTranscription}
            </p>

            {/* Fallback Warning */}
            {showFallbackWarning && !hasError && (
              <div style={{
                marginTop: '16px',
                padding: '10px 14px',
                background: 'rgba(245, 158, 11, 0.1)',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '13px',
                color: '#f59e0b',
              }}
              >
                <AlertCircle size={16} />
                <span>{t.home.textCopiedToClipboard}</span>
              </div>
            )}

            <div style={{
              display: 'flex',
              gap: '10px',
              marginTop: '20px',
              paddingTop: '20px',
              borderTop: '1px solid #2a2a2a',
            }}>
              <button
                onClick={handleCopy}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '10px 16px',
                  borderRadius: '8px',
                  border: '1px solid #333',
                  background: '#222',
                  color: '#999',
                  fontSize: '14px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
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
                  <><CheckCircle size={16} /> {t.home.copied}</>
                ) : (
                  <><Copy size={16} /> {t.home.copy}</>
                )}
              </button>

              <button
                onClick={handleInsert}
                disabled={insertionStatus?.accessibilityRequired}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '10px 16px',
                  borderRadius: '8px',
                  border: '1px solid #6366f1',
                  background: insertionStatus?.method === 'paste' 
                    ? 'rgba(34, 197, 94, 0.2)' 
                    : 'rgba(99, 102, 241, 0.1)',
                  color: insertionStatus?.method === 'paste' ? '#22c55e' : '#818cf8',
                  fontSize: '14px',
                  cursor: insertionStatus?.accessibilityRequired ? 'not-allowed' : 'pointer',
                  opacity: insertionStatus?.accessibilityRequired ? 0.5 : 1,
                  transition: 'all 0.2s',
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
                  <><CheckCircle size={16} /> {t.home.inserted}</>
                ) : (
                  <><Type size={16} /> {t.home.insertAtCursor}</>
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
            {t.home.emptyStateTitle}
          </p>
          <p style={{ fontSize: '12px', color: '#333' }}>
            {t.home.emptyStateSubtitle.replace('{hotkey}', hotkey)}
          </p>
        </div>
      )}
    </div>
  );
}
