import { useState, useEffect } from 'react';
import { Briefcase, X } from 'lucide-react';

interface Profile {
  id: string;
  name: string;
}

export function ActiveProfileBadge() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    // Check for active profile periodically
    const checkProfile = async () => {
      try {
        const currentProfile = await window.electronAPI.profileGetCurrent();
        setProfile(currentProfile);
      } catch (error) {
        console.error('Failed to get current profile:', error);
      }
    };

    checkProfile();
    const interval = setInterval(checkProfile, 2000);

    return () => clearInterval(interval);
  }, []);

  if (!profile || !isVisible) return null;

  return (
    <div style={{
      position: 'absolute',
      top: '16px',
      right: '16px',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '8px 12px',
      background: 'rgba(99, 102, 241, 0.1)',
      border: '1px solid rgba(99, 102, 241, 0.3)',
      borderRadius: '20px',
      fontSize: '13px',
      color: '#818cf8',
      animation: 'pulse 2s ease-in-out',
    }}>
      <Briefcase size={14} />
      <span>{profile.name}</span>
      <button
        onClick={() => setIsVisible(false)}
        style={{
          background: 'transparent',
          border: 'none',
          color: '#818cf8',
          cursor: 'pointer',
          padding: '2px',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <X size={12} />
      </button>
    </div>
  );
}
