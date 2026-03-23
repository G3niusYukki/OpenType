import { useState, useEffect } from 'react';
import { MainLayout } from './components/MainLayout';
import { UpdateModal } from './components/UpdateModal';
import { OnboardingWizard } from './components/OnboardingWizard/OnboardingWizard';
import { HomePage } from './pages/HomePage/HomePage';
import { SettingsPage } from './pages/SettingsPage/SettingsPage';
import { HistoryPage } from './pages/HistoryPage/HistoryPage';
import { DictionaryPage } from './pages/DictionaryPage';
import { ProfilesPage } from './pages/ProfilesPage/ProfilesPage';
import { DiagnosticsPage } from './pages/DiagnosticsPage';
import { UpdateProvider } from './contexts/UpdateContext';

type Page = 'home' | 'settings' | 'history' | 'dictionary' | 'diagnostics' | 'profiles';

export function App() {
  const [currentPage, setCurrentPage] = useState<Page>('home');
  const [showOnboarding, setShowOnboarding] = useState(
    localStorage.getItem('onboardingCompleted') !== 'true'
  );

  useEffect(() => {
    // Listen for navigation from main process
    const unsubscribe = window.electronAPI.onNavigate((path: string) => {
      if (path === '/settings') setCurrentPage('settings');
      if (path === '/history') setCurrentPage('history');
    });

    return unsubscribe;
  }, []);

  const renderPage = () => {
    switch (currentPage) {
      case 'home':
        return <HomePage />;
      case 'settings':
        return <SettingsPage />;
      case 'history':
        return <HistoryPage />;
      case 'dictionary':
        return <DictionaryPage />;
      case 'profiles':
        return <ProfilesPage />;
      case 'diagnostics':
        return <DiagnosticsPage />;
      default:
        return <HomePage />;
    }
  };

  return (
    <UpdateProvider>
    {showOnboarding ? (
      <OnboardingWizard onComplete={() => {
        localStorage.setItem('onboardingCompleted', 'true');
        setShowOnboarding(false);
      }} />
    ) : (
      <>
        <MainLayout currentPage={currentPage} onNavigate={setCurrentPage}>
          {renderPage()}
        </MainLayout>
        <UpdateModal />
      </>
    )}
    </UpdateProvider>
  );
}
