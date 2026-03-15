import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { I18nProvider, useI18n } from '../../src/renderer/i18n/I18nContext';
import { detectSystemLanguage, getTranslation } from '../../src/renderer/i18n/translations';

function Consumer() {
  const { language, isLoading, setLanguage, t } = useI18n();

  return (
    <>
      <div data-testid="language">{language}</div>
      <div data-testid="loading">{String(isLoading)}</div>
      <div data-testid="title">{t.settings.title}</div>
      <button onClick={() => void setLanguage('ja')}>set-ja</button>
    </>
  );
}

describe('I18nContext', () => {
  const storeGet = vi.fn();
  const storeSet = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, 'electronAPI', {
      value: {
        storeGet,
        storeSet,
      },
      configurable: true,
    });
  });

  it('throws when useI18n is used outside the provider', () => {
    expect(() => render(<Consumer />)).toThrow('useI18n must be used within an I18nProvider');
  });

  it('loads a saved language and persists language updates', async () => {
    storeGet.mockResolvedValue('zh');

    render(
      <I18nProvider>
        <Consumer />
      </I18nProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('language')).toHaveTextContent('zh');
      expect(screen.getByTestId('loading')).toHaveTextContent('false');
      expect(screen.getByTestId('title')).toHaveTextContent(getTranslation('zh').settings.title);
    });

    fireEvent.click(screen.getByText('set-ja'));

    await waitFor(() => {
      expect(storeSet).toHaveBeenCalledWith('app-language', 'ja');
      expect(screen.getByTestId('language')).toHaveTextContent('ja');
    });
  });

  it('maps supported locales and falls back to english', () => {
    Object.defineProperty(window.navigator, 'language', {
      value: 'ja-JP',
      configurable: true,
    });
    expect(detectSystemLanguage()).toBe('ja');

    Object.defineProperty(window.navigator, 'language', {
      value: 'fr-FR',
      configurable: true,
    });
    expect(detectSystemLanguage()).toBe('en');
  });
});
