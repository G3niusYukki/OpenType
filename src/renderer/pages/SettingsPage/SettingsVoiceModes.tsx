import { useState, useEffect } from 'react';
import { Card, Toggle, Select } from '../../components/ui';

const TRANSLATION_PAIRS = [
  { value: 'zh→en', label: 'CN → EN' },
  { value: 'en→zh', label: 'EN → CN' },
  { value: 'zh→ja', label: 'CN → JP' },
  { value: 'ja→zh', label: 'JP → CN' },
  { value: 'zh→ko', label: 'CN → KR' },
  { value: 'ko→zh', label: 'KR → CN' },
  { value: 'en→ja', label: 'EN → JP' },
  { value: 'en→ko', label: 'EN → KR' },
];

export function SettingsVoiceModes() {
  const [voiceInputModes, setVoiceInputModes] = useState({
    basicVoiceInput: true,
    handsFreeMode: true,
    translateToEnglish: true,
    editSelectedText: true,
  });
  const [translatePair, setTranslatePair] = useState('zh→en');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  useEffect(() => {
    loadSettings();
  }, []);

  const showSaveIndicator = () => {
    setSaveStatus('saving');
    setTimeout(() => setSaveStatus('saved'), 300);
    setTimeout(() => setSaveStatus('idle'), 1500);
  };

  const loadSettings = async () => {
    const [savedVoiceModes, savedTranslateSettings] = await Promise.all([
      window.electronAPI.storeGet('voiceInputModes'),
      window.electronAPI.storeGet('translateSettings'),
    ]);
    if (savedVoiceModes) {
      setVoiceInputModes(savedVoiceModes as typeof voiceInputModes);
    }
    if (savedTranslateSettings) {
      const ts = savedTranslateSettings as { sourceLang: string; targetLang: string };
      setTranslatePair(`${ts.sourceLang}→${ts.targetLang}`);
    }
  };

  const updateVoiceInputMode = async (mode: keyof typeof voiceInputModes, enabled: boolean) => {
    const newModes = { ...voiceInputModes, [mode]: enabled };
    setVoiceInputModes(newModes);
    showSaveIndicator();
    await window.electronAPI.storeSet('voiceInputModes', newModes);
  };

  const handleTranslatePairChange = async (value: string) => {
    setTranslatePair(value);
    showSaveIndicator();
    const [source, target] = value.split('→');
    await window.electronAPI.storeSet('translateSettings', { sourceLang: source, targetLang: target });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Save indicator */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        {saveStatus !== 'idle' && (
          <span style={{
            fontSize: '12px',
            color: saveStatus === 'saving' ? 'var(--color-accent)' : '#22c55e',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}>
            {saveStatus === 'saving' ? 'Saving...' : '✓ Saved'}
          </span>
        )}
      </div>

      <Card glass padding="lg">
        <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: 'var(--space-5)', marginTop: 0 }}>
          Enable or disable different voice input modes and their keyboard shortcuts
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <Toggle
            label="Basic Voice Input"
            description="Hold hotkey to speak, release to send. Auto-removes filler words."
            checked={voiceInputModes.basicVoiceInput}
            onChange={v => updateVoiceInputMode('basicVoiceInput', v)}
          />

          <Toggle
            label="Hands-free Mode"
            description="Toggle continuous recording mode. Press again to stop."
            checked={voiceInputModes.handsFreeMode}
            onChange={v => updateVoiceInputMode('handsFreeMode', v)}
          />

          <Toggle
            label="Translate to English"
            description="Speak in Chinese, output structured English text."
            checked={voiceInputModes.translateToEnglish}
            onChange={v => updateVoiceInputMode('translateToEnglish', v)}
          />

          {voiceInputModes.translateToEnglish && (
            <div style={{ paddingLeft: 'var(--space-4)' }}>
              <Select
                label="Language pair"
                options={TRANSLATION_PAIRS}
                value={translatePair}
                onChange={(e) => handleTranslatePairChange(e.target.value)}
              />
            </div>
          )}

          <Toggle
            label="Edit Selected Text"
            description='Select text, then speak commands like "translate to English" or "make it formal".'
            checked={voiceInputModes.editSelectedText}
            onChange={v => updateVoiceInputMode('editSelectedText', v)}
          />
        </div>
      </Card>
    </div>
  );
}
