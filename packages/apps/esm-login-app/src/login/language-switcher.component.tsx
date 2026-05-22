import { Button } from '@carbon/react';
import { ChevronDownIcon, TranslateIcon } from '@openmrs/esm-framework';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import styles from './login.module.scss';

const loginLocaleStorageKey = 'sihsalus.login.locale';

export interface LoginLanguageOption {
  locale: string;
  label: string;
}

interface LanguageSwitcherProps {
  locales: Array<LoginLanguageOption>;
}

function normalizeLocale(locale: string) {
  return locale.replace('_', '-');
}

function getLanguageFamily(locale: string) {
  return normalizeLocale(locale).split('-')[0];
}

function findLocaleMatch(locale: string, locales: Array<LoginLanguageOption>) {
  const normalizedLocale = normalizeLocale(locale);
  return (
    locales.find((option) => normalizeLocale(option.locale) === normalizedLocale)?.locale ??
    locales.find((option) => getLanguageFamily(option.locale) === getLanguageFamily(normalizedLocale))?.locale
  );
}

function setDocumentLanguage(locale: string) {
  document.documentElement.setAttribute('lang', normalizeLocale(locale));
}

export function LanguageSwitcher({ locales }: LanguageSwitcherProps) {
  const { i18n, t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const switcherRef = useRef<HTMLDivElement>(null);

  const availableLocales = useMemo(() => locales.filter((option) => option.locale && option.label), [locales]);

  const activeLocale = useMemo(() => {
    const currentLocale = i18n.resolvedLanguage || i18n.language || document.documentElement.lang;
    return findLocaleMatch(currentLocale, availableLocales) ?? availableLocales[0]?.locale;
  }, [availableLocales, i18n.language, i18n.resolvedLanguage]);

  const activeLanguage = availableLocales.find((option) => option.locale === activeLocale) ?? availableLocales[0];

  const changeLanguage = useCallback(
    (locale: string) => {
      const normalizedLocale = normalizeLocale(locale);
      window.localStorage.setItem(loginLocaleStorageKey, normalizedLocale);
      setDocumentLanguage(normalizedLocale);
      i18n.changeLanguage(normalizedLocale);
      setIsOpen(false);
    },
    [i18n],
  );

  useEffect(() => {
    const storedLocale = window.localStorage.getItem(loginLocaleStorageKey);
    const locale = storedLocale
      ? findLocaleMatch(storedLocale, availableLocales)
      : findLocaleMatch(document.documentElement.lang, availableLocales);

    if (locale && normalizeLocale(locale) !== normalizeLocale(i18n.language)) {
      setDocumentLanguage(locale);
      i18n.changeLanguage(normalizeLocale(locale));
    }
  }, [availableLocales, i18n]);

  useEffect(() => {
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (switcherRef.current && !switcherRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', closeOnOutsideClick);
    return () => document.removeEventListener('mousedown', closeOnOutsideClick);
  }, []);

  if (availableLocales.length < 2 || !activeLanguage) {
    return null;
  }

  return (
    <div className={styles.languageSwitcher} ref={switcherRef}>
      <Button
        aria-expanded={isOpen}
        aria-haspopup="menu"
        className={styles.languageButton}
        kind="ghost"
        onClick={() => setIsOpen((open) => !open)}
        renderIcon={(props) => <ChevronDownIcon size={16} {...props} />}
        size="sm"
        type="button"
      >
        <TranslateIcon size={16} />
        <span>{activeLanguage.label}</span>
      </Button>
      {isOpen ? (
        <div className={styles.languageMenu} role="menu" aria-label={t('selectLanguage', 'Select language')}>
          {availableLocales.map((option) => (
            <button
              aria-current={option.locale === activeLocale ? 'true' : undefined}
              aria-checked={option.locale === activeLocale}
              className={styles.languageMenuItem}
              key={option.locale}
              onClick={() => changeLanguage(option.locale)}
              role="menuitemradio"
              type="button"
            >
              <span>{option.label}</span>
              <span className={styles.languageLocale}>{normalizeLocale(option.locale).toUpperCase()}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
