import { interpolateUrl } from '@openmrs/esm-framework';

function getSpaBase() {
  if (typeof globalThis.getOpenmrsSpaBase === 'function') {
    return globalThis.getOpenmrsSpaBase();
  }

  return globalThis.spaBase ?? '/';
}

function isAbsoluteUrl(url: string) {
  return /^[a-z][a-z0-9+.-]*:/i.test(url);
}

export function buildSpaNavigationTarget(path: string) {
  if (isAbsoluteUrl(path)) {
    return path;
  }

  const spaBase = getSpaBase();
  const normalizedBase = spaBase.endsWith('/') ? spaBase.slice(0, -1) : spaBase;

  if (path === normalizedBase || path.startsWith(`${normalizedBase}/`)) {
    return path;
  }

  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  return `${normalizedBase}${normalizedPath}`;
}

export function resolveNavigationTarget(target: string) {
  const interpolatedTarget = interpolateUrl(target);

  if (isAbsoluteUrl(interpolatedTarget)) {
    return interpolatedTarget;
  }

  return new URL(interpolatedTarget, globalThis.location.origin).toString();
}

export function hardNavigate(target: string) {
  globalThis.location.assign(resolveNavigationTarget(target));
}
