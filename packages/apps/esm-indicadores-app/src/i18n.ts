const moduleName = '@sihsalus/esm-indicadores-app';

/**
 * Translates a key outside React components. Components use `useTranslation`
 * (which resolves the module namespace via I18nextProvider); non-component
 * modules must target the namespace explicitly, otherwise `i18next.t` falls
 * back to the instance default namespace and the key is never found.
 */
export function translate(key: string, defaultValue: string): string {
  const i18next = (
    globalThis as typeof globalThis & {
      i18next?: { t?: (key: string, options: { defaultValue: string; ns: string }) => string };
    }
  ).i18next;

  return typeof i18next?.t === 'function' ? i18next.t(key, { defaultValue, ns: moduleName }) : defaultValue;
}
