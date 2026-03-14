import { useState, useEffect, useCallback } from 'react';
import { Mic, Square, Copy, Type, Settings } from 'lucide-react';

export function HomePage() {
  const [isRecording, setIsRecording] = useState(false);
  const [lastTranscription, setLastTranscription] = useState('');
  const [hotkey, setHotkey] = useState('⌘⇧D');

  useEffect(() => {
    // Load hotkey on mount
    window.electronAPI.storeGet('hotkey').then((key: unknown) => {
      if (key) setHotkey(formatHotkey(key as string));
    });

    // Subscribe to recording events
    const unsubStart = window.electronAPI.onRecordingStarted(() => {
      setIsRecording(true);
    });

    const unsubStop = window.electronAPI.onRecordingStopped(() => {
      setIsRecording(false);
    });

    const unsubTranscription = window.electronAPI.onTranscriptionComplete((text: string) => {
      setLastTranscription(text);
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
      await window.electronAPI.recordingStart();
    }
  }, [isRecording]);

  const handleCopy = () => {
    navigator.clipboard.writeText(lastTranscription);
  };

  const handleInsert = async () => {
    await window.electronAPI.textInsert(lastTranscription);
  };

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px',
      background: 'linear-gradient(180deg, #0f0f0f 0%, #13131f 100%)',
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

      {/* Transcription Result */}
      {lastTranscription && (
        <div style={{
          marginTop: '48px',
          width: '100%',
          maxWidth: '600px',
        }}>
          <p style={{
            fontSize: '12px',
            color: '#666',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            marginBottom: '12px',
          }}>
            Last Transcription
          </p>
          
          <div style={{
            background: '#1a1a1a',
            border: '1px solid #2a2a2a',
            borderRadius: '12px',
            padding: '20px',
          }}>
            <p style={{
              fontSize: '16px',
              lineHeight: 1.6,
              color: '#e5e5e5',
              margin: 0,
              minHeight: '24px',
            }}>
              {lastTranscription}
            </p>

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
                <Copy size={14} /> Copy
              </button>

              <button
                onClick={handleInsert}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 14px',
                  borderRadius: '6px',
                  border: '1px solid #6366f1',
                  background: 'rgba(99, 102, 241, 0.1)',
                  color: '#818cf8',
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(99, 102, 241, 0.2)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(99, 102, 241, 0.1)';
                }}
              >
                <Type size={14} /> Insert at Cursor
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!lastTranscription && !isRecording && (
        <div style={{
          marginTop: '48px',
          textAlign: 'center',
          color: '#444',
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
