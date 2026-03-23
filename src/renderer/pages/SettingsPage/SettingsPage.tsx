import { useState } from 'react';
import styles from './SettingsPage.module.css';
import { SettingsGeneral } from './SettingsGeneral';
import { SettingsTranscription } from './SettingsTranscription';
import { SettingsAI } from './SettingsAI';
import { SettingsVoiceModes } from './SettingsVoiceModes';
import { SettingsData } from './SettingsData';

type Tab = 'general' | 'transcription' | 'ai' | 'voice' | 'data';

const tabs: { id: Tab; label: string }[] = [
  { id: 'general', label: 'General' },
  { id: 'transcription', label: 'Transcription' },
  { id: 'ai', label: 'AI' },
  { id: 'voice', label: 'Voice Modes' },
  { id: 'data', label: 'Data' },
];

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('general');

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Settings</h1>
      </div>

      <div className={styles.tabs}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`${styles.tab} ${activeTab === tab.id ? styles.active : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className={styles.content}>
        {activeTab === 'general' && <SettingsGeneral />}
        {activeTab === 'transcription' && <SettingsTranscription />}
        {activeTab === 'ai' && <SettingsAI />}
        {activeTab === 'voice' && <SettingsVoiceModes />}
        {activeTab === 'data' && <SettingsData />}
      </div>
    </div>
  );
}
