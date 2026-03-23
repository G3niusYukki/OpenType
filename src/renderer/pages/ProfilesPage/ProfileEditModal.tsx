import { useState } from 'react';
import { Modal, Card, Input, Select, Toggle, Button } from '../../components/ui';

interface DictationProfile {
  id: string;
  name: string;
  appIdentifiers: string[];
  settings: {
    language: string;
    preferredProvider: 'local' | 'cloud' | 'auto';
    aiPostProcessing: {
      enabled: boolean;
      options: {
        removeFillerWords: boolean;
        removeRepetition: boolean;
        detectSelfCorrection: boolean;
      };
    };
  };
  isDefault: boolean;
}

interface ProfileEditModalProps {
  profile: DictationProfile;
  onSave: (profile: DictationProfile) => void;
  onCancel: () => void;
  onDelete?: (id: string) => void;
}

const LANGUAGES = [
  { value: 'en-US', label: 'English (US)' },
  { value: 'zh-CN', label: '中文 (简体)' },
  { value: 'zh-TW', label: '中文 (繁體)' },
  { value: 'ja-JP', label: '日本語' },
  { value: 'ko-KR', label: '한국어' },
  { value: 'fr-FR', label: 'Français' },
  { value: 'de-DE', label: 'Deutsch' },
];

const PROVIDERS = [
  { value: 'auto', label: 'Auto (Local first)' },
  { value: 'local', label: 'Local (whisper.cpp)' },
  { value: 'cloud', label: 'Cloud (API)' },
];

export function ProfileEditModal({ profile, onSave, onCancel, onDelete }: ProfileEditModalProps) {
  const [name, setName] = useState(profile.name);
  const [appIds, setAppIds] = useState(profile.appIdentifiers.join(', '));
  const [language, setLanguage] = useState(profile.settings.language);
  const [provider, setProvider] = useState(profile.settings.preferredProvider);
  const [aiEnabled, setAiEnabled] = useState(profile.settings.aiPostProcessing.enabled);
  const [removeFiller, setRemoveFiller] = useState(profile.settings.aiPostProcessing.options.removeFillerWords);
  const [removeRepetition, setRemoveRepetition] = useState(profile.settings.aiPostProcessing.options.removeRepetition);
  const [detectSelfCorrection, setDetectSelfCorrection] = useState(profile.settings.aiPostProcessing.options.detectSelfCorrection);

  const handleSave = () => {
    const updated: DictationProfile = {
      ...profile,
      name: name.trim() || 'Unnamed Profile',
      appIdentifiers: appIds.split(',').map(s => s.trim()).filter(Boolean),
      settings: {
        language,
        preferredProvider: provider,
        aiPostProcessing: {
          enabled: aiEnabled,
          options: {
            removeFillerWords: removeFiller,
            removeRepetition,
            detectSelfCorrection,
          },
        },
      },
    };
    onSave(updated);
  };

  return (
    <Modal title={profile.id && profile.name !== 'New Profile' ? 'Edit Profile' : 'New Profile'} onClose={onCancel} size="md">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
        <Input
          label="Profile Name"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g., Development"
          autoFocus
        />
        <Input
          label="Target Apps"
          value={appIds}
          onChange={e => setAppIds(e.target.value)}
          placeholder="com.apple.Notes, com.tinyspeck.slackmacgrohl (comma-separated)"
        />
        <Select
          label="Language"
          value={language}
          options={LANGUAGES}
          onChange={e => setLanguage(e.target.value)}
        />
        <Select
          label="Provider"
          value={provider}
          options={PROVIDERS}
          onChange={e => setProvider(e.target.value as 'local' | 'cloud' | 'auto')}
        />
        <Toggle
          label="AI Post-Processing"
          description="Automatically clean up transcription"
          checked={aiEnabled}
          onChange={setAiEnabled}
        />
        {aiEnabled && (
          <div style={{ paddingLeft: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', borderLeft: '2px solid var(--color-border-subtle)' }}>
            <Toggle label="Remove Filler Words" checked={removeFiller} onChange={setRemoveFiller} />
            <Toggle label="Remove Repetition" checked={removeRepetition} onChange={setRemoveRepetition} />
            <Toggle label="Detect Self-Correction" checked={detectSelfCorrection} onChange={setDetectSelfCorrection} />
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 'var(--space-2)' }}>
          <div>
            {onDelete && profile.id && (
              <Button variant="danger" onClick={() => onDelete(profile.id)}>Delete</Button>
            )}
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
            <Button variant="secondary" onClick={onCancel}>Cancel</Button>
            <Button variant="primary" onClick={handleSave}>Save Profile</Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
