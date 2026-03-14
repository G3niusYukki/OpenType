import { useState, useEffect } from 'react';
import { Plus, Trash2, BookOpen } from 'lucide-react';

interface DictionaryEntry {
  word: string;
  replacement: string;
}

export function DictionaryPage() {
  const [entries, setEntries] = useState<DictionaryEntry[]>([]);
  const [newWord, setNewWord] = useState('');
  const [newReplacement, setNewReplacement] = useState('');

  useEffect(() => {
    loadDictionary();
  }, []);

  const loadDictionary = async () => {
    const dict = await window.electronAPI.dictionaryGet();
    setEntries(dict as DictionaryEntry[]);
  };

  const addEntry = async () => {
    if (!newWord.trim() || !newReplacement.trim()) return;
    
    await window.electronAPI.dictionaryAdd(newWord.trim(), newReplacement.trim());
    setNewWord('');
    setNewReplacement('');
    loadDictionary();
  };

  const removeEntry = async (word: string) => {
    await window.electronAPI.dictionaryRemove(word);
    loadDictionary();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      addEntry();
    }
  };

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: '32px' }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '32px',
      }}>
        <h1 style={{
          fontSize: '24px',
          fontWeight: 600,
          color: '#fff',
          margin: 0,
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}>
          <BookOpen size={24} />
          Custom Dictionary
        </h1>

        <span style={{
          padding: '6px 12px',
          background: 'rgba(99, 102, 241, 0.1)',
          color: '#818cf8',
          borderRadius: '20px',
          fontSize: '13px',
        }}>
          {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
        </span>
      </div>

      <p style={{
        fontSize: '14px',
        color: '#666',
        marginBottom: '24px',
        maxWidth: '600px',
      }}>
        Add custom words and their replacements. These will be automatically applied to your transcriptions.
        Useful for names, technical terms, or correcting common transcription errors.
      </p>

      {/* Add New Entry */}
      <div style={{
        background: '#161616',
        border: '1px solid #222',
        borderRadius: '12px',
        padding: '20px',
        marginBottom: '24px',
      }}>
        <h3 style={{
          fontSize: '14px',
          fontWeight: 600,
          color: '#ccc',
          margin: '0 0 16px 0',
        }}>
          Add New Entry
        </h3>

        <div style={{
          display: 'flex',
          gap: '12px',
          alignItems: 'flex-end',
        }}>
          <div style={{ flex: 1 }}>
            <label style={{
              display: 'block',
              fontSize: '12px',
              color: '#666',
              marginBottom: '6px',
            }}>
              Word / Phrase
            </label>
            <input
              type="text"
              value={newWord}
              onChange={(e) => setNewWord(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="e.g., openai"
              style={{
                width: '100%',
                padding: '12px 16px',
                background: '#0f0f0f',
                border: '1px solid #2a2a2a',
                borderRadius: '8px',
                color: '#fff',
                fontSize: '14px',
              }}
            />
          </div>

          <div style={{ flex: 1 }}>
            <label style={{
              display: 'block',
              fontSize: '12px',
              color: '#666',
              marginBottom: '6px',
            }}>
              Replacement
            </label>
            <input
              type="text"
              value={newReplacement}
              onChange={(e) => setNewReplacement(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="e.g., OpenAI"
              style={{
                width: '100%',
                padding: '12px 16px',
                background: '#0f0f0f',
                border: '1px solid #2a2a2a',
                borderRadius: '8px',
                color: '#fff',
                fontSize: '14px',
              }}
            />
          </div>

          <button
            onClick={addEntry}
            disabled={!newWord.trim() || !newReplacement.trim()}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '12px 20px',
              borderRadius: '8px',
              border: 'none',
              background: (!newWord.trim() || !newReplacement.trim()) ? '#333' : '#6366f1',
              color: (!newWord.trim() || !newReplacement.trim()) ? '#666' : '#fff',
              fontSize: '14px',
              fontWeight: 500,
              cursor: (!newWord.trim() || !newReplacement.trim()) ? 'not-allowed' : 'pointer',
            }}
          >
            <Plus size={18} />
            Add
          </button>
        </div>
      </div>

      {/* Entries List */}
      <div style={{
        background: '#161616',
        border: '1px solid #222',
        borderRadius: '12px',
        overflow: 'hidden',
      }}>
        {entries.length === 0 ? (
          <div style={{
            padding: '60px 20px',
            textAlign: 'center',
            color: '#444',
          }}>
            <BookOpen size={48} style={{ marginBottom: '16px', opacity: 0.3 }} />
            <p style={{ margin: '0 0 8px 0', fontSize: '15px' }}>No dictionary entries yet</p>
            <p style={{ margin: 0, fontSize: '13px' }}>Add your first custom replacement above</p>
          </div>
        ) : (
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
          }}>
            <thead>
              <tr style={{
                background: '#1a1a1a',
                borderBottom: '1px solid #222',
              }}>
                <th style={{
                  padding: '14px 20px',
                  textAlign: 'left',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#666',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}>
                  Word / Phrase
                </th>
                <th style={{
                  padding: '14px 20px',
                  textAlign: 'left',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#666',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}>
                  Replacement
                </th>
                <th style={{
                  width: '60px',
                  padding: '14px 20px',
                }}></th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, index) => (
                <tr
                  key={entry.word}
                  style={{
                    borderBottom: index < entries.length - 1 ? '1px solid #222' : 'none',
                  }}
                >
                  <td style={{
                    padding: '16px 20px',
                    fontSize: '14px',
                    color: '#ccc',
                    fontFamily: 'monospace',
                  }}>
                    {entry.word}
                  </td>
                  <td style={{
                    padding: '16px 20px',
                    fontSize: '14px',
                    color: '#818cf8',
                  }}>
                    {entry.replacement}
                  </td>
                  <td style={{
                    padding: '16px 20px',
                  }}>
                    <button
                      onClick={() => removeEntry(entry.word)}
                      style={{
                        padding: '6px',
                        borderRadius: '4px',
                        border: 'none',
                        background: 'transparent',
                        color: '#666',
                        cursor: 'pointer',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = '#ef4444';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = '#666';
                      }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Example Section */}
      {entries.length > 0 && (
        <div style={{
          marginTop: '24px',
          padding: '16px 20px',
          background: 'rgba(99, 102, 241, 0.05)',
          border: '1px solid rgba(99, 102, 241, 0.2)',
          borderRadius: '8px',
        }}>
          <p style={{
            fontSize: '13px',
            color: '#818cf8',
            margin: 0,
          }}>
            💡 Dictionary replacements are applied automatically to all new transcriptions.
          </p>
        </div>
      )}
    </div>
  );
}
