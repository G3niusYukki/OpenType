import { ReactNode } from 'react';
import { Mic, Settings, History, BookOpen, Minus, X } from 'lucide-react';

type Page = 'home' | 'settings' | 'history' | 'dictionary';

interface MainLayoutProps {
  children: ReactNode;
  currentPage: Page;
  onNavigate: (page: Page) => void;
}

const navItems: { id: Page; label: string; icon: typeof Mic }[] = [
  { id: 'home', label: 'Dictate', icon: Mic },
  { id: 'history', label: 'History', icon: History },
  { id: 'dictionary', label: 'Dictionary', icon: BookOpen },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export function MainLayout({ children, currentPage, onNavigate }: MainLayoutProps) {
  const handleMinimize = () => {
    window.electronAPI.windowHide();
  };

  return (
    <div style={{
      display: 'flex',
      height: '100vh',
      background: '#0f0f0f',
    }}>
      {/* Sidebar */}
      <nav style={{
        width: '64px',
        background: '#161616',
        borderRight: '1px solid #222',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '16px 0',
        WebkitAppRegion: 'drag',
      }}>
        <div style={{ 
          marginBottom: '32px',
          WebkitAppRegion: 'no-drag',
        }}>
          <div style={{
            width: '36px',
            height: '36px',
            background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '18px',
            fontWeight: 'bold',
          }}>
            O
          </div>
        </div>

        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          flex: 1,
          WebkitAppRegion: 'no-drag',
        }}>
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

        {/* Window controls */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
          marginTop: 'auto',
          paddingTop: '16px',
          borderTop: '1px solid #222',
          WebkitAppRegion: 'no-drag',
        }}>
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

      {/* Main content */}
      <main style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {children}
      </main>
    </div>
  );
}
