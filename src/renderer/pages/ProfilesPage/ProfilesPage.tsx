import { useState, useEffect } from 'react';
import { Plus, Trash2, Briefcase, AlertCircle } from 'lucide-react';
import { ProfileEditModal } from './ProfileEditModal';
import styles from './ProfilesPage.module.css';

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

export function ProfilesPage() {
  const [profiles, setProfiles] = useState<DictationProfile[]>([]);
  const [editingProfile, setEditingProfile] = useState<DictationProfile | null>(null);

  useEffect(() => { loadProfiles(); }, []);

  const loadProfiles = async () => {
    try {
      const profiles = await window.electronAPI.profileGetAll();
      setProfiles(profiles || []);
    } catch (error) {
      console.error('Failed to load profiles:', error);
    }
  };

  const saveProfile = async (profile: DictationProfile) => {
    try {
      await window.electronAPI.profileSave(profile);
      await loadProfiles();
      setEditingProfile(null);
    } catch (error) {
      console.error('Failed to save profile:', error);
    }
  };

  const deleteProfile = async (profileId: string) => {
    try {
      await window.electronAPI.profileDelete(profileId);
      await loadProfiles();
    } catch (error) {
      console.error('Failed to delete profile:', error);
    }
  };

  const createNewProfile = () => {
    const newProfile: DictationProfile = {
      id: Date.now().toString(),
      name: 'New Profile',
      appIdentifiers: [],
      settings: {
        language: 'en-US',
        preferredProvider: 'auto',
        aiPostProcessing: {
          enabled: false,
          options: { removeFillerWords: true, removeRepetition: true, detectSelfCorrection: true },
        },
      },
      isDefault: false,
    };
    setEditingProfile(newProfile);
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.titleSection}>
          <h1 className={styles.title}>Dictation Profiles</h1>
          <p className={styles.subtitle}>Configure per-app dictation settings</p>
        </div>
        <button className={`${styles.newBtn}`} onClick={createNewProfile}>
          <Plus size={16} />
          New Profile
        </button>
      </div>

      {profiles.length === 0 ? (
        <div className={styles.emptyState}>
          <AlertCircle size={48} className={styles.emptyIcon} />
          <p>No profiles created yet</p>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
            Create profiles to customize dictation settings for different apps
          </p>
        </div>
      ) : (
        <div className={styles.profileGrid}>
          {profiles.map((profile) => (
            <div key={profile.id} className={styles.profileCard}>
              <div className={styles.profileHeader}>
                <div className={styles.profileMeta}>
                  <div className={styles.profileName}>
                    <Briefcase size={16} color="var(--color-primary)" />
                    {profile.name}
                    {profile.isDefault && (
                      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-success)', fontWeight: 'normal' }}>
                        (Default)
                      </span>
                    )}
                  </div>
                  <div className={styles.profileApps}>
                    {profile.appIdentifiers.length} app{profile.appIdentifiers.length !== 1 ? 's' : ''} assigned
                  </div>
                </div>
                <div className={styles.profileActions}>
                  <button className={styles.editBtn} onClick={() => setEditingProfile(profile)}>Edit</button>
                  <button className={styles.deleteBtn} onClick={() => deleteProfile(profile.id)}><Trash2 size={14} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {editingProfile && (
        <ProfileEditModal
          profile={editingProfile}
          onSave={saveProfile}
          onCancel={() => setEditingProfile(null)}
          onDelete={deleteProfile}
        />
      )}
    </div>
  );
}
