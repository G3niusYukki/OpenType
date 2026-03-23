import { useState, useEffect } from 'react';
import { Trash2, Copy, Clock, FileAudio } from 'lucide-react';
import styles from './HistoryPage.module.css';

interface HistoryItem {
  id: string;
  timestamp: number;
  audioPath: string;
  text: string;
  status: 'pending' | 'completed' | 'error';
}

export function HistoryPage() {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    loadHistory();

    // Refresh when transcription completes
    const unsub = window.electronAPI.onTranscriptionComplete(() => {
      loadHistory();
    });

    return unsub;
  }, []);

  const loadHistory = async () => {
    const items = await window.electronAPI.historyGet(100);
    setHistory(items as HistoryItem[]);
  };

  const deleteItem = async (id: string) => {
    await window.electronAPI.historyDelete(id);
    setHistory(prev => prev.filter(item => item.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const clearAll = async () => {
    await window.electronAPI.historyClear();
    setHistory([]);
    setSelectedId(null);
  };

  const copyText = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  const selectedItem = history.find(item => item.id === selectedId);

  return (
    <div className={styles.page}>
      {/* History List */}
      <div className={styles.listPanel}>
        <div className={styles.listHeader}>
          <h2 className={styles.listTitle}>History</h2>

          {history.length > 0 && (
            <button className={styles.clearAllBtn} onClick={clearAll}>
              Clear All
            </button>
          )}
        </div>

        <div className={styles.listScroll}>
          {history.length === 0 ? (
            <div className={styles.listEmpty}>
              <FileAudio size={32} className={styles.listEmptyIcon} />
              <p className={styles.listEmptyText}>No transcriptions yet</p>
            </div>
          ) : (
            history.map((item) => (
              <button
                key={item.id}
                className={`${styles.listItem} ${selectedId === item.id ? styles.active : ''}`}
                onClick={() => setSelectedId(item.id)}
              >
                <p className={styles.listItemText}>
                  {item.text.slice(0, 60) || 'No text'}
                </p>

                <div className={styles.listItemMeta}>
                  <Clock size={10} />
                  {formatDate(item.timestamp)}
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Detail View */}
      <div className={styles.detailPanel}>
        {selectedItem ? (
          <div>
            <div className={styles.detailHeader}>
              <div className={styles.detailMeta}>
                <p className={styles.detailTimestamp}>
                  {formatDate(selectedItem.timestamp)}
                </p>
                <span className={`${styles.detailBadge} ${styles[selectedItem.status]}`}>
                  {selectedItem.status}
                </span>
              </div>

              <div className={styles.detailActions}>
                <button
                  className={styles.actionBtn}
                  onClick={() => copyText(selectedItem.text)}
                >
                  <Copy size={14} /> Copy
                </button>

                <button
                  className={`${styles.actionBtn} ${styles.danger}`}
                  onClick={() => deleteItem(selectedItem.id)}
                >
                  <Trash2 size={14} /> Delete
                </button>
              </div>
            </div>

            <div className={styles.detailTextBox}>
              <p className={styles.detailText}>
                {selectedItem.text || (
                  <span className={styles.detailTextPlaceholder}>No transcription text</span>
                )}
              </p>
            </div>

            {selectedItem.audioPath && (
              <audio
                controls
                src={`file://${selectedItem.audioPath}`}
                className={styles.audioPlayer}
              />
            )}

            <div className={styles.audioSection}>
              <p className={styles.audioLabel}>Audio File</p>
              <p className={styles.audioPath}>{selectedItem.audioPath}</p>
            </div>
          </div>
        ) : (
          <div className={styles.emptyState}>
            <Clock size={48} className={styles.emptyIcon} />
            <p className={styles.emptyMessage}>Select an item to view details</p>
          </div>
        )}
      </div>
    </div>
  );
}
