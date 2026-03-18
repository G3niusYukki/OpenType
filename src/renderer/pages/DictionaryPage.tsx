import { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, BookOpen, Upload, Download, Tag } from 'lucide-react';

interface DictionaryEntry {
  word: string;
  replacement: string;
  category?: string;
  createdAt?: number;
}

interface DictionaryCategory {
  id: string;
  name: string;
  color: string;
}

const ALL_CATEGORY = 'all';

export function DictionaryPage() {
  const [entries, setEntries] = useState<DictionaryEntry[]>([]);
  const [categories, setCategories] = useState<DictionaryCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>(ALL_CATEGORY);
  const [newWord, setNewWord] = useState('');
  const [newReplacement, setNewReplacement] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [search, setSearch] = useState('');
  const [importStatus, setImportStatus] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadDictionary();
    loadCategories();
  }, []);

  const loadDictionary = async () => {
    const dict = await window.electronAPI.dictionaryGet();
    setEntries(dict as DictionaryEntry[]);
  };

  const loadCategories = async () => {
    const cats = await window.electronAPI.dictionaryGetCategories();
    setCategories(cats);
  };

  const filteredEntries = entries.filter(e => {
    const matchesCategory = selectedCategory === ALL_CATEGORY || e.category === selectedCategory;
    const matchesSearch = !search || e.word.toLowerCase().includes(search.toLowerCase()) || e.replacement.toLowerCase().includes(search.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const addEntry = async () => {
    if (!newWord.trim() || !newReplacement.trim()) return;
    const category = newCategory || undefined;
    await window.electronAPI.dictionaryAdd(newWord.trim(), newReplacement.trim(), category);
    setNewWord('');
    setNewReplacement('');
    setNewCategory('');
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

  const handleImport = async (format: 'json' | 'csv') => {
    const result = await window.electronAPI.dictionaryExport(format);
    const blob = new Blob([result], { type: format === 'json' ? 'application/json' : 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dictionary.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const format = file.name.endsWith('.csv') ? 'csv' : 'json';
    const importResult = await window.electronAPI.dictionaryImport(format, text);
    const msg = `Imported ${importResult.imported}, skipped ${importResult.skipped}${importResult.errors.length > 0 ? `, ${importResult.errors.length} errors` : ''}`;
    setImportStatus(msg);
    setTimeout(() => setImportStatus(''), 3000);
    loadDictionary();
    loadCategories();
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const getCategoryColor = (id: string): string => {
    return categories.find(c => c.id === id)?.color || '#6366f1';
  };

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: '32px' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '24px',
        flexWrap: 'wrap',
        gap: '12px',
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

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={() => fileInputRef.current?.click()}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '8px',
              border: '1px solid #2a2a2a',
              background: '#1a1a1a',
              color: '#999',
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            <Upload size={14} />
            Import
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,.csv"
            style={{ display: 'none' }}
            onChange={handleFileImport}
          />

          <div style={{ position: 'relative' }}>
            <button
              onClick={() => {
                const btn = document.getElementById('export-dropdown');
                if (btn) btn.style.display = btn.style.display === 'none' ? 'block' : 'none';
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                borderRadius: '8px',
                border: '1px solid #2a2a2a',
                background: '#1a1a1a',
                color: '#999',
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              <Download size={14} />
              Export
            </button>
            <div id="export-dropdown" style={{ display: 'none', position: 'absolute', top: '100%', right: 0, marginTop: '4px', background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '8px', overflow: 'hidden', zIndex: 100 }}>
              <button onClick={() => { handleImport('json'); const d = document.getElementById('export-dropdown'); if (d) d.style.display = 'none'; }} style={{ display: 'block', width: '100%', padding: '8px 16px', border: 'none', background: 'transparent', color: '#ccc', fontSize: '13px', cursor: 'pointer', textAlign: 'left' }}>Export as JSON</button>
              <button onClick={() => { handleImport('csv'); const d = document.getElementById('export-dropdown'); if (d) d.style.display = 'none'; }} style={{ display: 'block', width: '100%', padding: '8px 16px', border: 'none', background: 'transparent', color: '#ccc', fontSize: '13px', cursor: 'pointer', textAlign: 'left' }}>Export as CSV</button>
            </div>
          </div>

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
      </div>

      {importStatus && (
        <div style={{ padding: '10px 16px', background: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.3)', borderRadius: '8px', color: '#22c55e', fontSize: '13px', marginBottom: '16px' }}>
          {importStatus}
        </div>
      )}

      <p style={{
        fontSize: '14px',
        color: '#666',
        marginBottom: '24px',
        maxWidth: '600px',
      }}>
        Add custom words and their replacements. These will be automatically applied to your transcriptions.
        Useful for names, technical terms, or correcting common transcription errors.
      </p>

      {/* Category Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <button
          onClick={() => setSelectedCategory(ALL_CATEGORY)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 14px',
            borderRadius: '20px',
            border: 'none',
            background: selectedCategory === ALL_CATEGORY ? 'rgba(99, 102, 241, 0.2)' : '#1a1a1a',
            color: selectedCategory === ALL_CATEGORY ? '#818cf8' : '#666',
            fontSize: '13px',
            cursor: 'pointer',
          }}
        >
          All
        </button>
        {categories.map(cat => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: '20px',
              border: 'none',
              background: selectedCategory === cat.id ? `${cat.color}33` : '#1a1a1a',
              color: selectedCategory === cat.id ? cat.color : '#666',
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            <Tag size={12} />
            {cat.name}
          </button>
        ))}
      </div>

      {/* Search */}
      <div style={{ marginBottom: '16px' }}>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search words or replacements..."
          style={{
            width: '100%',
            maxWidth: '400px',
            padding: '10px 16px',
            background: '#161616',
            border: '1px solid #222',
            borderRadius: '8px',
            color: '#fff',
            fontSize: '14px',
          }}
        />
      </div>

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
          flexWrap: 'wrap',
        }}>
          <div style={{ flex: '1', minWidth: '160px' }}>
            <label style={{ display: 'block', fontSize: '12px', color: '#666', marginBottom: '6px' }}>
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

          <div style={{ flex: '1', minWidth: '160px' }}>
            <label style={{ display: 'block', fontSize: '12px', color: '#666', marginBottom: '6px' }}>
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

          <div style={{ minWidth: '140px' }}>
            <label style={{ display: 'block', fontSize: '12px', color: '#666', marginBottom: '6px' }}>
              Category
            </label>
            <select
              value={newCategory}
              onChange={e => setNewCategory(e.target.value)}
              style={{
                width: '100%',
                padding: '12px 16px',
                background: '#0f0f0f',
                border: '1px solid #2a2a2a',
                borderRadius: '8px',
                color: '#ccc',
                fontSize: '14px',
              }}
            >
              <option value="">None</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
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
        {filteredEntries.length === 0 ? (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: '#444' }}>
            <BookOpen size={48} style={{ marginBottom: '16px', opacity: 0.3 }} />
            <p style={{ margin: '0 0 8px 0', fontSize: '15px' }}>
              {entries.length === 0 ? 'No dictionary entries yet' : 'No entries in this category'}
            </p>
            <p style={{ margin: 0, fontSize: '13px' }}>
              {entries.length === 0 ? 'Add your first custom replacement above' : 'Try a different category or search'}
            </p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#1a1a1a', borderBottom: '1px solid #222' }}>
                <th style={{ padding: '14px 20px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#666', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Word / Phrase</th>
                <th style={{ padding: '14px 20px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#666', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Replacement</th>
                <th style={{ padding: '14px 20px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#666', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Category</th>
                <th style={{ width: '60px', padding: '14px 20px' }}></th>
              </tr>
            </thead>
            <tbody>
              {filteredEntries.map((entry, index) => (
                <tr key={entry.word} style={{ borderBottom: index < filteredEntries.length - 1 ? '1px solid #222' : 'none' }}>
                  <td style={{ padding: '16px 20px', fontSize: '14px', color: '#ccc', fontFamily: 'monospace' }}>
                    {entry.word}
                  </td>
                  <td style={{ padding: '16px 20px', fontSize: '14px', color: '#818cf8' }}>
                    {entry.replacement}
                  </td>
                  <td style={{ padding: '16px 20px' }}>
                    {entry.category ? (
                      <span style={{
                        padding: '2px 8px',
                        background: `${getCategoryColor(entry.category)}22`,
                        color: getCategoryColor(entry.category),
                        borderRadius: '12px',
                        fontSize: '12px',
                      }}>
                        {categories.find(c => c.id === entry.category)?.name || entry.category}
                      </span>
                    ) : (
                      <span style={{ color: '#444', fontSize: '12px' }}>—</span>
                    )}
                  </td>
                  <td style={{ padding: '16px 20px' }}>
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
                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#ef4444'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#666'; }}
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

      {entries.length > 0 && (
        <div style={{ marginTop: '24px', padding: '16px 20px', background: 'rgba(99, 102, 241, 0.05)', border: '1px solid rgba(99, 102, 241, 0.2)', borderRadius: '8px' }}>
          <p style={{ fontSize: '13px', color: '#818cf8', margin: 0 }}>
            Dictionary replacements are applied automatically to all new transcriptions.
          </p>
        </div>
      )}
    </div>
  );
}
