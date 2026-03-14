import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  Language,
  Translations,
  detectSystemLanguage,
  getTranslation,
  supportedLanguages,
} from './translations';

interface I18nContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: Translations;
  supportedLanguages: typeof supportedLanguages;
  isLoading: boolean;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

const STORAGE_KEY = 'app-language';

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>('en');
  const [isLoading, setIsLoading] = useState(true);

  // Load saved language or detect on mount
  useEffect(() => {
    const loadLanguage = async () => {
      try {
        // Try to get saved language from store
        const savedLang = await window.electronAPI.storeGet(STORAGE_KEY);
        
        if (savedLang && isValidLanguage(savedLang as string)) {
          setLanguageState(savedLang as Language);
        } else {
          // Detect system language
          const systemLang = detectSystemLanguage();
          setLanguageState(systemLang);
          // Save detected language
          await window.electronAPI.storeSet(STORAGE_KEY, systemLang);
        }
      } catch (error) {
        console.error('Failed to load language:', error);
        // Fallback to detected language
        const systemLang = detectSystemLanguage();
        setLanguageState(systemLang);
      } finally {
        setIsLoading(false);
      }
    };

    loadLanguage();
  }, []);

  const setLanguage = useCallback(async (lang: Language) => {
    try {
      await window.electronAPI.storeSet(STORAGE_KEY, lang);
      setLanguageState(lang);
    } catch (error) {
      console.error('Failed to save language:', error);
      setLanguageState(lang);
    }
  }, []);

  const t = getTranslation(language);

  const value: I18nContextType = {
    language,
    setLanguage,
    t,
    supportedLanguages,
    isLoading,
  };

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (context === undefined) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
}

function isValidLanguage(lang: string): lang is Language {
  return ['en', 'zh', 'ja', 'ko'].includes(lang);
}
