import { useState, useEffect } from 'react';
import { MainLayout } from './components/MainLayout';
import { UpdateModal } from './components/UpdateModal';
import { HomePage } from './pages/HomePage/HomePage';
import { SettingsPage } from './pages/SettingsPage/SettingsPage';
import { HistoryPage } from './pages/HistoryPage';
import { DictionaryPage } from './pages/DictionaryPage';
import { ProfilesPage } from './pages/ProfilesPage';
import { DiagnosticsPage } from './pages/DiagnosticsPage';
import { UpdateProvider } from './contexts/UpdateContext';

type Page = 'home' | 'settings' | 'history' | 'dictionary' | 'diagnostics' | 'profiles';

export function App() {
  const [currentPage, setCurrentPage] = useState<Page>('home');

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
    <MainLayout currentPage={currentPage} onNavigate={setCurrentPage}>
      {renderPage()}
    </MainLayout>
    <UpdateModal />
    </UpdateProvider>
  );
}
