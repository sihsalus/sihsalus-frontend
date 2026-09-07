import { Type, validator } from '@openmrs/esm-framework';

const publicHelpUrls = [
  { hostname: 'docs.sihsalus.org', pathPrefix: '/' },
  { hostname: 'sihsalus.github.io', pathPrefix: '/sihsalus-docs/' },
] as const;

export function getSafeHelpUrl(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const url = value.trim();
  const containsUnsafeCharacter = [...url].some((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return character === '\\' || codePoint < 0x20 || codePoint === 0x7f;
  });
  if (!url || containsUnsafeCharacter) {
    return null;
  }

  if (url.startsWith('/') && !url.startsWith('//')) {
    const parsedUrl = new URL(url, 'https://sihsalus.invalid');
    return parsedUrl.pathname === '/ayuda' || parsedUrl.pathname.startsWith('/ayuda/') ? url : null;
  }

  try {
    const parsedUrl = new URL(url);
    if (parsedUrl.protocol !== 'https:' || parsedUrl.username || parsedUrl.password || parsedUrl.port) {
      return null;
    }

    const allowedUrl = publicHelpUrls.find(({ hostname }) => parsedUrl.hostname === hostname);
    if (!allowedUrl) {
      return null;
    }

    return parsedUrl.pathname.startsWith(allowedUrl.pathPrefix) ? url : null;
  } catch {
    return null;
  }
}

const helpUrlValidator = validator(
  (value: unknown) => (typeof value === 'string' && value.trim() === '') || getSafeHelpUrl(value) !== null,
  'Must be empty, a path under /ayuda, or an approved SIHSALUS documentation HTTPS URL',
);

export const configSchema = {
  releaseNotesUrl: {
    _type: Type.String,
    _default: '/ayuda/novedades/',
    _description: 'URL for user-facing SIHSALUS release notes. Leave empty to hide the menu item.',
    _validators: [helpUrlValidator],
  },
  documentationUrl: {
    _type: Type.String,
    _default: '/ayuda/',
    _description: 'URL for the SIHSALUS user documentation portal. Leave empty to hide the menu item.',
    _validators: [helpUrlValidator],
  },
  supportUrl: {
    _type: Type.String,
    _default: '/ayuda/soporte/',
    _description: 'URL for safe help and support instructions. Leave empty to hide the menu item.',
    _validators: [helpUrlValidator],
  },
};

export type ConfigObject = {
  releaseNotesUrl: string;
  documentationUrl: string;
  supportUrl: string;
};
