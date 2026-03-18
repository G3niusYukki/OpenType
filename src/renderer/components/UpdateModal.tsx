import { useState, useEffect } from 'react';

interface UpdateState {
  status: 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'error';
  version?: string;
  releaseNotes?: string;
  progress?: number;
  error?: string;
}

export function UpdateModal() {
  const [state, setState] = useState<UpdateState>({ status: 'idle' });
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Get initial state
    window.electronAPI.updateGetState().then(s => {
      setState(s);
      if (s.status === 'available' || s.status === 'downloading' || s.status === 'downloaded') {
        setVisible(true);
      }
    });

    // Subscribe to updates
    const unsub = window.electronAPI.onUpdateState((s: UpdateState) => {
      setState(s);
      if (s.status === 'available' || s.status === 'downloading' || s.status === 'downloaded') {
        setVisible(true);
      }
    });

    return unsub;
  }, []);

  if (!visible) return null;

  const handleDownload = () => window.electronAPI.updateDownload();
  const handleInstall = () => window.electronAPI.updateInstall();
  const handleDismiss = () => setVisible(false);

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
    }}>
      <div style={{
        background: '#1a1a1a',
        border: '1px solid #2a2a2a',
        borderRadius: '16px',
        padding: '32px',
        maxWidth: '480px',
        width: '90%',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      }}>
        {state.status === 'checking' && (
          <>
            <h2 style={{ color: '#fff', marginTop: 0 }}>Checking for updates...</h2>
            <div style={{ color: '#666', fontSize: '14px' }}>Please wait</div>
          </>
        )}

        {state.status === 'available' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <span style={{
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                color: '#fff',
                padding: '4px 12px',
                borderRadius: '20px',
                fontSize: '13px',
                fontWeight: 600,
              }}>
                Update Available
              </span>
              <span style={{ color: '#818cf8', fontSize: '14px' }}>v{state.version}</span>
            </div>
            <h2 style={{ color: '#fff', marginTop: 0 }}>OpenType {state.version} is ready!</h2>
            <div style={{ color: '#888', fontSize: '14px', marginBottom: '20px', maxHeight: '200px', overflowY: 'auto', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
              {state.releaseNotes || 'New version with improvements.'}
            </div>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button onClick={handleDismiss} style={{
                padding: '10px 20px',
                borderRadius: '8px',
                border: '1px solid #333',
                background: '#222',
                color: '#999',
                fontSize: '14px',
                cursor: 'pointer',
              }}>
                Later
              </button>
              <button onClick={handleDownload} style={{
                padding: '10px 20px',
                borderRadius: '8px',
                border: 'none',
                background: '#6366f1',
                color: '#fff',
                fontSize: '14px',
                fontWeight: 500,
                cursor: 'pointer',
              }}>
                Download &amp; Install
              </button>
            </div>
          </>
        )}

        {state.status === 'downloading' && (
          <>
            <h2 style={{ color: '#fff', marginTop: 0 }}>Downloading update...</h2>
            <div style={{ margin: '20px 0' }}>
              <div style={{
                height: '8px',
                background: '#2a2a2a',
                borderRadius: '4px',
                overflow: 'hidden',
              }}>
                <div style={{
                  height: '100%',
                  width: `${state.progress || 0}%`,
                  background: 'linear-gradient(90deg, #6366f1, #8b5cf6)',
                  borderRadius: '4px',
                  transition: 'width 0.3s ease',
                }} />
              </div>
              <div style={{ color: '#666', fontSize: '13px', marginTop: '8px', textAlign: 'center' }}>
                {state.progress}% downloaded
              </div>
            </div>
          </>
        )}

        {state.status === 'downloaded' && (
          <>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              background: 'rgba(34, 197, 94, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '16px',
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h2 style={{ color: '#fff', marginTop: 0 }}>Update Ready!</h2>
            <p style={{ color: '#888', fontSize: '14px', marginBottom: '20px' }}>
              OpenType will restart to apply the update.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button onClick={handleDismiss} style={{
                padding: '10px 20px',
                borderRadius: '8px',
                border: '1px solid #333',
                background: '#222',
                color: '#999',
                fontSize: '14px',
                cursor: 'pointer',
              }}>
                Restart Later
              </button>
              <button onClick={handleInstall} style={{
                padding: '10px 20px',
                borderRadius: '8px',
                border: 'none',
                background: '#22c55e',
                color: '#fff',
                fontSize: '14px',
                fontWeight: 500,
                cursor: 'pointer',
              }}>
                Restart Now
              </button>
            </div>
          </>
        )}

        {state.status === 'error' && (
          <>
            <h2 style={{ color: '#ef4444', marginTop: 0 }}>Update Error</h2>
            <p style={{ color: '#888', fontSize: '14px', marginBottom: '20px' }}>
              {state.error || 'Failed to check for updates.'}
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button onClick={handleDismiss} style={{
                padding: '10px 20px',
                borderRadius: '8px',
                border: '1px solid #333',
                background: '#222',
                color: '#999',
                fontSize: '14px',
                cursor: 'pointer',
              }}>
                Dismiss
              </button>
              <button onClick={() => window.electronAPI.updateCheck()} style={{
                padding: '10px 20px',
                borderRadius: '8px',
                border: 'none',
                background: '#6366f1',
                color: '#fff',
                fontSize: '14px',
                fontWeight: 500,
                cursor: 'pointer',
              }}>
                Try Again
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
