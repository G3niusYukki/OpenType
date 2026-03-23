import { ReactNode } from 'react';
import { Mic, Settings, History, BookOpen, Minus, Activity, Briefcase } from 'lucide-react';
import { Tooltip } from './ui';
import styles from './MainLayout.module.css';

type Page = 'home' | 'settings' | 'history' | 'dictionary' | 'diagnostics' | 'profiles';

interface MainLayoutProps {
  children: ReactNode;
  currentPage: Page;
  onNavigate: (page: Page) => void;
}

const navItems: { id: Page; label: string; icon: typeof Mic }[] = [
  { id: 'home', label: 'Dictate', icon: Mic },
  { id: 'history', label: 'History', icon: History },
  { id: 'dictionary', label: 'Dictionary', icon: BookOpen },
  { id: 'profiles', label: 'Profiles', icon: Briefcase },
  { id: 'diagnostics', label: 'Diagnostics', icon: Activity },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export function MainLayout({ children, currentPage, onNavigate }: MainLayoutProps) {
  const handleMinimize = () => {
    window.electronAPI.windowHide();
  };

  return (
    <div className={styles.layout}>
      <nav className={styles.nav}>
        <div className={styles.logo}>
          <div className={styles.logoIcon}>O</div>
        </div>

        <div className={styles.navList}>
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = currentPage === item.id;
            return (
              <Tooltip key={item.id} content={item.label} position="right">
                <button
                  className={`${styles.navButton} ${isActive ? styles.active : ''}`}
                  onClick={() => onNavigate(item.id)}
                  aria-label={item.label}
                  title={item.label}
                >
                  <Icon size={20} />
                </button>
              </Tooltip>
            );
          })}
        </div>

        <div className={styles.navFooter}>
          <button
            className={styles.minimizeButton}
            onClick={handleMinimize}
            aria-label="Minimize to tray"
          >
            <Minus size={16} />
          </button>
        </div>
      </nav>

      <main className={styles.main}>{children}</main>
    </div>
  );
}
