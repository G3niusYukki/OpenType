import { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, BookOpen, Upload, Download, Tag } from 'lucide-react';
import styles from './DictionaryPage.module.css';

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
  const [exportOpen, setExportOpen] = useState(false);
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

  const handleExport = async (format: 'json' | 'csv') => {
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
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <h1 className={styles.title}>
          <BookOpen size={24} />
          Custom Dictionary
        </h1>

        <div className={styles.actions}>
          <button
            onClick={() => fileInputRef.current?.click()}
            className={styles.ghostBtn}
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

          <div className={styles.exportWrapper}>
            <button
              onClick={() => setExportOpen(v => !v)}
              className={styles.ghostBtn}
            >
              <Download size={14} />
              Export
            </button>
            {exportOpen && (
              <div className={styles.exportDropdown}>
                <button
                  className={styles.dropdownItem}
                  onClick={() => { handleExport('json'); setExportOpen(false); }}
                >
                  Export as JSON
                </button>
                <button
                  className={styles.dropdownItem}
                  onClick={() => { handleExport('csv'); setExportOpen(false); }}
                >
                  Export as CSV
                </button>
              </div>
            )}
          </div>

          <span className={styles.countBadge}>
            {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
          </span>
        </div>
      </div>

      {importStatus && (
        <div className={styles.importStatus}>
          {importStatus}
        </div>
      )}

      <p className={styles.description}>
        Add custom words and their replacements. These will be automatically applied to your transcriptions.
        Useful for names, technical terms, or correcting common transcription errors.
      </p>

      {/* Category Tabs */}
      <div className={styles.categoryTabs}>
        <button
          onClick={() => setSelectedCategory(ALL_CATEGORY)}
          className={`${styles.categoryTab}${selectedCategory === ALL_CATEGORY ? ` ${styles.categoryTabActive}` : ''}`}
        >
          All
        </button>
        {categories.map(cat => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            className={`${styles.categoryTab}${selectedCategory === cat.id ? ` ${styles.categoryTabActive}` : ''}`}
          >
            <Tag size={12} />
            {cat.name}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className={styles.search}>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search words or replacements..."
          className={styles.searchInput}
        />
      </div>

      {/* Add New Entry */}
      <div className={styles.addCard}>
        <h3 className={styles.addTitle}>Add New Entry</h3>

        <div className={styles.addRow}>
          <div className={styles.field}>
            <label className={styles.fieldLabel}>Word / Phrase</label>
            <input
              type="text"
              value={newWord}
              onChange={(e) => setNewWord(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="e.g., openai"
              className={styles.fieldInput}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.fieldLabel}>Replacement</label>
            <input
              type="text"
              value={newReplacement}
              onChange={(e) => setNewReplacement(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="e.g., OpenAI"
              className={styles.fieldInput}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.fieldLabel}>Category</label>
            <select
              value={newCategory}
              onChange={e => setNewCategory(e.target.value)}
              className={styles.fieldSelect}
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
            className={styles.addBtn}
          >
            <Plus size={18} />
            Add
          </button>
        </div>
      </div>

      {/* Entries List */}
      <div className={styles.tableCard}>
        {filteredEntries.length === 0 ? (
          <div className={styles.emptyState}>
            <BookOpen size={48} className={styles.emptyIcon} />
            <p className={styles.emptyTitle}>
              {entries.length === 0 ? 'No dictionary entries yet' : 'No entries in this category'}
            </p>
            <p className={styles.emptyHint}>
              {entries.length === 0 ? 'Add your first custom replacement above' : 'Try a different category or search'}
            </p>
          </div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr className={styles.tableHeadRow}>
                <th className={styles.tableHeadCell}>Word / Phrase</th>
                <th className={styles.tableHeadCell}>Replacement</th>
                <th className={styles.tableHeadCell}>Category</th>
                <th className={styles.tableHeadCellAction}></th>
              </tr>
            </thead>
            <tbody>
              {filteredEntries.map(entry => (
                <tr key={entry.word} className={styles.tableBodyRow}>
                  <td className={`${styles.tableCell} ${styles.wordCell}`}>
                    {entry.word}
                  </td>
                  <td className={`${styles.tableCell} ${styles.replacementCell}`}>
                    {entry.replacement}
                  </td>
                  <td className={styles.tableCell}>
                    {entry.category ? (
                      <span
                        className={styles.categoryBadge}
                        style={{
                          background: `${getCategoryColor(entry.category)}22`,
                          color: getCategoryColor(entry.category),
                        }}
                      >
                        {categories.find(c => c.id === entry.category)?.name || entry.category}
                      </span>
                    ) : (
                      <span style={{ color: '#444', fontSize: '12px' }}>—</span>
                    )}
                  </td>
                  <td className={styles.tableCell}>
                    <button
                      onClick={() => removeEntry(entry.word)}
                      className={styles.deleteBtn}
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
        <div className={styles.infoBanner}>
          <p className={styles.infoBannerText}>
            Dictionary replacements are applied automatically to all new transcriptions.
          </p>
        </div>
      )}
    </div>
  );
}
