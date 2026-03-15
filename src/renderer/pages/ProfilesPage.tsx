import { useState, useEffect } from 'react';
import { Plus, Trash2, Briefcase, Check, AlertCircle } from 'lucide-react';

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
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    loadProfiles();
  }, []);

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
      setIsCreating(false);
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
          options: {
            removeFillerWords: true,
            removeRepetition: true,
            detectSelfCorrection: true,
          },
        },
      },
      isDefault: false,
    };
    setEditingProfile(newProfile);
    setIsCreating(true);
  };

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: '32px' }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '32px',
      }}>
        <div>
          <h1 style={{
            fontSize: '24px',
            fontWeight: 600,
            color: '#fff',
            margin: '0 0 8px 0',
          }}>
            Dictation Profiles
          </h1>
          <p style={{ color: '#666', margin: 0, fontSize: '14px' }}>
            Configure per-app dictation settings
          </p>
        </div>
        
        <button
          onClick={createNewProfile}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 16px',
            background: '#6366f1',
            border: 'none',
            borderRadius: '8px',
            color: '#fff',
            fontSize: '14px',
            cursor: 'pointer',
          }}
        >
          <Plus size={16} />
          New Profile
        </button>
      </div>

      {profiles.length === 0 ? (
        <div style={{
          padding: '48px',
          textAlign: 'center',
          color: '#666',
          background: '#161616',
          border: '1px solid #222',
          borderRadius: '12px',
        }}>
          <AlertCircle size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
          <p>No profiles created yet</p>
          <p style={{ fontSize: '13px', color: '#888' }}>
            Create profiles to customize dictation settings for different apps
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {profiles.map((profile) => (
            <div
              key={profile.id}
              style={{
                background: '#161616',
                border: '1px solid #222',
                borderRadius: '12px',
                padding: '20px',
              }}
            >
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <Briefcase size={20} color="#6366f1" />
                  <div>
                    <h3 style={{
                      margin: 0,
                      fontSize: '16px',
                      fontWeight: 600,
                      color: '#fff',
                    }}>
                      {profile.name}
                      {profile.isDefault && (
                        <span style={{
                          marginLeft: '8px',
                          fontSize: '12px',
                          color: '#22c55e',
                          fontWeight: 'normal',
                        }}>
                          (Default)
                        </span>
                      )}
                    </h3>
                    <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#666' }}>
                      {profile.appIdentifiers.length} app{profile.appIdentifiers.length !== 1 ? 's' : ''} assigned
                    </p>
                  </div>
                </div>
                
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => setEditingProfile(profile)}
                    style={{
                      padding: '8px 12px',
                      background: '#333',
                      border: '1px solid #444',
                      borderRadius: '6px',
                      color: '#fff',
                      fontSize: '13px',
                      cursor: 'pointer',
                    }}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => deleteProfile(profile.id)}
                    style={{
                      padding: '8px',
                      background: 'transparent',
                      border: '1px solid #444',
                      borderRadius: '6px',
                      color: '#ef4444',
                      cursor: 'pointer',
                    }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
