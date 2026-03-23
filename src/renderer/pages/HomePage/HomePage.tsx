// src/renderer/pages/HomePage/HomePage.tsx
import { useState, useEffect, useCallback, useRef } from 'react';
import { Mic, Square, Copy, Type, AlertCircle, CheckCircle, Activity, Server, Cloud, Cpu, ChevronDown } from 'lucide-react';
import { SystemStatusPanel } from '../../components/SystemStatusPanel';
import { Card, Badge, Button } from '../../components/ui';
import styles from './HomePage.module.css';

const WAVE_HEIGHTS = [12, 20, 32, 18, 26, 14]; // Fixed heights — replaces Math.random()

function AudioWaveform({ isRecording }: { isRecording: boolean }) {
  return (
    <div className={`${styles.waveform} ${isRecording ? styles.active : ''}`}>
      {WAVE_HEIGHTS.map((_, i) => (
        <div
          key={i}
          className={styles.waveBar}
          style={{ animationDelay: `${i * 80}ms` }}
        />
      ))}
    </div>
  );
}

function RecordingTimer({ isRecording }: { isRecording: boolean }) {
  const [seconds, setSeconds] = useState(0);
  const ref = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (isRecording) {
      setSeconds(0);
      ref.current = setInterval(() => setSeconds(s => s + 1), 1000);
    } else {
      clearInterval(ref.current!);
      setSeconds(0);
    }
    return () => clearInterval(ref.current!);
  }, [isRecording]);
  const fmt = (n: number) => `${Math.floor(n / 60).toString().padStart(2, '0')}:${(n % 60).toString().padStart(2, '0')}`;
  if (!isRecording) return null;
  return (
    <div className={styles.timer}>
      <span style={{ color: 'var(--color-error)' }}>●</span>
      <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-error)' }}>{fmt(seconds)}</span>
      <Activity size={14} color="var(--color-error)" />
    </div>
  );
}

export function HomePage() {
  const [isRecording, setIsRecording] = useState(false);
  const [lastTranscription, setLastTranscription] = useState('');
  const [lastResult, setLastResult] = useState<any>(null);
  const [hotkey, setHotkey] = useState('⌘⇧D');
  const [insertionStatus, setInsertionStatus] = useState<any>(null);
  const [showRawText, setShowRawText] = useState(false);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [preferredProvider, setPreferredProvider] = useState<'local' | 'cloud' | 'auto'>('auto');
  const [showProviderDropdown, setShowProviderDropdown] = useState(false);
  const [rightTab, setRightTab] = useState<'current' | 'history'>('current');
  const [history, setHistory] = useState<any[]>([]);

  // Helper: must be defined before useEffect that calls it
  const formatHotkey = (k: string) =>
    k.replace('CommandOrControl+', '⌘').replace('Control+', '⌃').replace('Alt+', '⌥').replace('Shift+', '⇧').replace('Command', '⌘');

  useEffect(() => {
    window.electronAPI.aiGetSettings().then((s: any) => setAiEnabled(s.enabled));
    window.electronAPI.storeGet('preferredProvider').then((p: any) => p && setPreferredProvider(p));
    window.electronAPI.storeGet('hotkey').then((k: any) => k && setHotkey(formatHotkey(k)));
    window.electronAPI.historyGet(5).then((h: any[]) => setHistory(h));
  }, []);

  useEffect(() => {
    const u1 = window.electronAPI.onRecordingStarted(() => {
      setIsRecording(true);
      setInsertionStatus(null);
    });
    const u2 = window.electronAPI.onRecordingStopped(() => setIsRecording(false));
    const u3 = window.electronAPI.onTranscriptionComplete((r: any) => {
      setLastTranscription(r.text);
      setLastResult(r);
      if (r.fallbackToClipboard) setInsertionStatus({ method: 'clipboard' });
    });
    return () => { u1(); u2(); u3(); };
  }, []);

  const toggleRecording = useCallback(async () => {
    if (isRecording) await window.electronAPI.recordingStop();
    else {
      setLastResult(null);
      setInsertionStatus(null);
      await window.electronAPI.recordingStart();
    }
  }, [isRecording]);

  const PROVIDER_ICONS: Record<string, typeof Server> = { auto: Server, local: Cpu, cloud: Cloud };
  const PROVIDER_LABELS: Record<string, string> = { auto: 'Auto (Local first)', local: 'Local (whisper.cpp)', cloud: 'Cloud (API)' };
  const ProviderIcon = PROVIDER_ICONS[preferredProvider];

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <SystemStatusPanel />
        <div style={{ position: 'relative' }}>
          <button className={styles.providerBtn} onClick={() => setShowProviderDropdown(d => !d)}>
            <ProviderIcon size={14} />
            <span>{PROVIDER_LABELS[preferredProvider]}</span>
            <ChevronDown size={14} />
          </button>
          {showProviderDropdown && (
            <div className={styles.dropdown}>
              {(['auto', 'local', 'cloud'] as const).map(id => {
                const Icon = PROVIDER_ICONS[id];
                return (
                  <button
                    key={id}
                    className={`${styles.dropdownItem} ${preferredProvider === id ? styles.dropdownActive : ''}`}
                    onClick={async () => {
                      setPreferredProvider(id);
                      await window.electronAPI.storeSet('preferredProvider', id);
                      setShowProviderDropdown(false);
                    }}
                  >
                    <Icon size={14} />
                    <span>{PROVIDER_LABELS[id]}</span>
                    {preferredProvider === id && (
                      <CheckCircle size={14} style={{ marginLeft: 'auto' }} />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className={styles.split}>
        {/* 左栏：录音控制 */}
        <div className={styles.recordPanel}>
          <AudioWaveform isRecording={isRecording} />
          <button
            className={`${styles.recordBtn} ${isRecording ? styles.recording : ''}`}
            onClick={toggleRecording}
          >
            <div className={styles.recordBtnInner} />
          </button>
          <p className={`${styles.hint} ${isRecording ? styles.active : ''}`}>
            {isRecording ? 'Recording...' : `Hold ${hotkey} to start`}
          </p>
          <RecordingTimer isRecording={isRecording} />
        </div>

        {/* 右栏：转写结果 */}
        <div className={styles.resultPanel}>
          <div className={styles.tabs}>
            <button
              className={`${styles.tab} ${rightTab === 'current' ? styles.activeTab : ''}`}
              onClick={() => setRightTab('current')}
            >
              Current
            </button>
            <button
              className={`${styles.tab} ${rightTab === 'history' ? styles.activeTab : ''}`}
              onClick={() => setRightTab('history')}
            >
              Recent ({history.length})
            </button>
          </div>

          {rightTab === 'current' && (
            <>
              {lastTranscription ? (
                <Card glass padding="lg">
                  <div className={styles.resultMeta}>
                    <Badge variant={lastResult?.success ? 'success' : 'error'}>
                      {lastResult?.provider && `via ${lastResult.provider}`}
                    </Badge>
                    {lastResult?.aiProcessed && <Badge variant="info">+ AI polish</Badge>}
                    {lastResult?.aiLatency && (
                      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                        {lastResult.aiLatency}ms
                      </span>
                    )}
                  </div>
                  {lastResult?.aiProcessed && (
                    <div className={styles.tabs} style={{ marginBottom: 'var(--space-3)' }}>
                      <button
                        className={`${styles.tab} ${!showRawText ? styles.activeTab : ''}`}
                        onClick={() => setShowRawText(false)}
                      >
                        Polished
                      </button>
                      <button
                        className={`${styles.tab} ${showRawText ? styles.activeTab : ''}`}
                        onClick={() => setShowRawText(true)}
                      >
                        Original
                      </button>
                    </div>
                  )}
                  <p className={styles.resultText}>
                    {showRawText && lastResult?.rawText ? lastResult.rawText : lastTranscription}
                  </p>
                  {insertionStatus?.method === 'clipboard' && (
                    <div className={styles.fallbackWarning}>
                      <AlertCircle size={14} />
                      <span>Text copied to clipboard</span>
                    </div>
                  )}
                  <div className={styles.resultActions}>
                    <Button
                      variant="secondary"
                      icon={<Copy size={14} />}
                      onClick={async () => {
                        await navigator.clipboard.writeText(lastTranscription);
                        setInsertionStatus({ method: 'clipboard' });
                      }}
                    >
                      {insertionStatus?.method === 'clipboard' ? 'Copied' : 'Copy'}
                    </Button>
                    <Button
                      variant="primary"
                      icon={<Type size={14} />}
                      onClick={async () => {
                        const r = await window.electronAPI.textInsert(lastTranscription);
                        setInsertionStatus({ method: r.method });
                      }}
                    >
                      {insertionStatus?.method === 'paste' ? 'Inserted' : 'Insert at Cursor'}
                    </Button>
                  </div>
                </Card>
              ) : (
                <div className={styles.emptyState}>No transcription yet. Hold ⌘⇧D to start.</div>
              )}
            </>
          )}

          {rightTab === 'history' && (
            <div className={styles.historyList}>
              {history.length === 0 ? (
                <div className={styles.emptyState}>No history yet.</div>
              ) : (
                history.map((item: any) => (
                  <button
                    key={item.id}
                    className={styles.historyItem}
                    onClick={() => {
                      setLastTranscription(item.text);
                      setLastResult(item);
                      setRightTab('current');
                    }}
                  >
                    <div className={styles.historyText}>{item.text?.slice(0, 80) || 'No text'}</div>
                    <div className={styles.historyTime}>
                      {new Date(item.timestamp).toLocaleString()}
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
