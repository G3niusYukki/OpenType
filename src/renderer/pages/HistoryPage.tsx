import { useState, useEffect } from 'react';
import { Trash2, Copy, Clock, FileAudio } from 'lucide-react';

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
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
      {/* History List */}
      <div style={{
        width: '320px',
        borderRight: '1px solid #222',
        background: '#161616',
        display: 'flex',
        flexDirection: 'column',
      }}>
        <div style={{
          padding: '20px',
          borderBottom: '1px solid #222',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <h2 style={{
            fontSize: '16px',
            fontWeight: 600,
            color: '#fff',
            margin: 0,
          }}>
            History
          </h2>
          
          {history.length > 0 && (
            <button
              onClick={clearAll}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                border: '1px solid #333',
                background: 'transparent',
                color: '#666',
                fontSize: '12px',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#ef4444';
                e.currentTarget.style.borderColor = '#ef4444';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = '#666';
                e.currentTarget.style.borderColor = '#333';
              }}
            >
              Clear All
            </button>
          )}
        </div>

        <div style={{
          flex: 1,
          overflow: 'auto',
          padding: '8px',
        }}>
          {history.length === 0 ? (
            <div style={{
              padding: '40px 20px',
              textAlign: 'center',
              color: '#444',
            }}>
              <FileAudio size={32} style={{ marginBottom: '12px', opacity: 0.5 }}
3e
              <p style={{ fontSize: '13px' }}>No transcriptions yet</p>
            </div>
          ) : (
            history.map((item) => (
              <button
                key={item.id}
                onClick={() => setSelectedId(item.id)}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  background: selectedId === item.id ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                  textAlign: 'left',
                  cursor: 'pointer',
                  marginBottom: '4px',
                }}
              >
                <p style={{
                  fontSize: '13px',
                  color: '#ccc',
                  margin: '0 0 4px 0',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {item.text.slice(0, 60) || 'No text'}
                </p>
                
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '11px',
                  color: '#555',
                }}>
                  <Clock size={10} />
                  {formatDate(item.timestamp)}
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Detail View */}
      <div style={{
        flex: 1,
        padding: '32px',
        overflow: 'auto',
      }}>
        {selectedItem ? (
          <div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '24px',
            }}>
              <div>
                <p style={{
                  fontSize: '12px',
                  color: '#666',
                  margin: '0 0 4px 0',
                }}>
                  {formatDate(selectedItem.timestamp)}
                </p>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}>
                  <span style={{
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    textTransform: 'uppercase',
                    background: selectedItem.status === 'completed' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                    color: selectedItem.status === 'completed' ? '#22c55e' : '#f59e0b',
                  }}>
                    {selectedItem.status}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => copyText(selectedItem.text)}
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
                >
                  <Copy size={14} /> Copy
                </button>

                <button
                  onClick={() => deleteItem(selectedItem.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 14px',
                    borderRadius: '6px',
                    border: '1px solid #333',
                    background: '#222',
                    color: '#ef4444',
                    fontSize: '13px',
                    cursor: 'pointer',
                  }}
                >
                  <Trash2 size={14} /> Delete
                </button>
              </div>
            </div>

            <div style={{
              background: '#161616',
              border: '1px solid #222',
              borderRadius: '12px',
              padding: '24px',
            }}>
              <p style={{
                fontSize: '15px',
                lineHeight: 1.7,
                color: '#e5e5e5',
                margin: 0,
                whiteSpace: 'pre-wrap',
              }}>
                {selectedItem.text || <span style={{ color: '#444', fontStyle: 'italic' }}>No transcription text</span>}
              </p>
            </div>

            <div style={{
              marginTop: '24px',
              padding: '16px',
              background: '#1a1a1a',
              borderRadius: '8px',
            }}>
              <p style={{
                fontSize: '11px',
                color: '#444',
                margin: '0 0 4px 0',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
              }}>
                Audio File
              </p>
              <p style={{
                fontSize: '12px',
                color: '#666',
                margin: 0,
                fontFamily: 'monospace',
              }}>
                {selectedItem.audioPath}
              </p>
            </div>
          </div>
        ) : (
          <div style={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#444',
          }}>
            <Clock size={48} style={{ marginBottom: '16px', opacity: 0.3 }}>/>
            <p>Select an item to view details</p>
          </div>
        )}
      </div>
    </div>
  );
}
