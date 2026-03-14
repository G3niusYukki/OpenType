import { useState, useEffect } from 'react';
import { MainLayout } from './components/MainLayout';
import { HomePage } from './pages/HomePage';
import { SettingsPage } from './pages/SettingsPage';
import { HistoryPage } from './pages/HistoryPage';
import { DictionaryPage } from './pages/DictionaryPage';

type Page = 'home' | 'settings' | 'history' | 'dictionary';

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
      default:
        return <HomePage />;
    }
  };

  return (
    <MainLayout currentPage={currentPage} onNavigate={setCurrentPage}>
      {renderPage()}
    </MainLayout>
  );
}
