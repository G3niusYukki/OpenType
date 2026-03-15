import { ReactNode } from 'react';
import { Mic, Settings, History, BookOpen, Minus, Activity, Briefcase } from 'lucide-react';
import { useI18n } from '../i18n';

type Page = 'home' | 'settings' | 'history' | 'dictionary' | 'diagnostics' | 'profiles';

interface MainLayoutProps {
  children: ReactNode;
  currentPage: Page;
  onNavigate: (page: Page) => void;
}

const dragRegion = { WebkitAppRegion: 'drag' } as any;
const noDragRegion = { WebkitAppRegion: 'no-drag' } as any;

export function MainLayout({ children, currentPage, onNavigate }: MainLayoutProps) {
  const { t } = useI18n();
  
  const handleMinimize = () => {
    window.electronAPI.windowHide();
  };

  const navItems: { id: Page; label: string; icon: typeof Mic }[] = [
    { id: 'home', label: t.nav.dictate, icon: Mic },
    { id: 'history', label: t.nav.history, icon: History },
    { id: 'dictionary', label: t.nav.dictionary, icon: BookOpen },
    { id: 'profiles', label: 'Profiles', icon: Briefcase },
    { id: 'diagnostics', label: 'Diagnostics', icon: Activity },
    { id: 'settings', label: t.nav.settings, icon: Settings },
  ];

  return (
    <div
      style={{
        display: 'flex',
        height: '100vh',
        background: '#0f0f0f',
      }}
    >
      <nav
        style={{
          width: '64px',
          background: '#161616',
          borderRight: '1px solid #222',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '28px 0 16px 0',
          ...dragRegion,
        }}
      >
        <div
          style={{
            marginBottom: '24px',
            ...noDragRegion,
          }}
        >
          <div
            style={{
              width: '36px',
              height: '36px',
              background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '18px',
              fontWeight: 'bold',
            }}
          >
            O
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            flex: 1,
            ...noDragRegion,
          }}
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPage === item.id;

            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                title={item.label}
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '10px',
                  border: 'none',
                  background: isActive ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                  color: isActive ? '#818cf8' : '#666',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                    e.currentTarget.style.color = '#999';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = '#666';
                  }
                }}
              >
                <Icon size={20} />
              </button>
            );
          })}
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            marginTop: 'auto',
            paddingTop: '16px',
            borderTop: '1px solid #222',
            ...noDragRegion,
          }}
        >
          <button
            onClick={handleMinimize}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '6px',
              border: 'none',
              background: 'transparent',
              color: '#666',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
              e.currentTarget.style.color = '#999';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = '#666';
            }}
          >
            <Minus size={16} />
          </button>
        </div>
      </nav>

      <main
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {children}
      </main>
    </div>
  );
}
