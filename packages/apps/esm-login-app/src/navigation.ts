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

/**
 * Guards navigation targets that originate from user-controlled input (query
 * params, router state). Only same-origin paths are allowed: an absolute URL
 * would let a crafted login link redirect the clinician to an attacker's site
 * right after they authenticate, and a `javascript:` target would execute in
 * the authenticated origin.
 */
export function isSafeInternalTarget(target: string | null | undefined): target is string {
  if (typeof target !== 'string' || !target.startsWith('/') || target.startsWith('//')) {
    return false;
  }

  try {
    return new URL(target, globalThis.location.origin).origin === globalThis.location.origin;
  } catch {
    return false;
  }
}

/**
 * Guards the route restored after authentication. Login and logout routes are
 * valid same-origin URLs, but restoring either of them would send an already
 * authenticated user back into the authentication flow.
 */
export function isSafePostLoginTarget(target: string | null | undefined): target is string {
  if (!isSafeInternalTarget(target)) {
    return false;
  }

  const spaBase = getSpaBase();
  const normalizedBase = spaBase.endsWith('/') ? spaBase.slice(0, -1) : spaBase;
  const pathname = new URL(target, globalThis.location.origin).pathname.replace(/\/+$/, '') || '/';
  const spaRelativePath =
    pathname === normalizedBase
      ? '/'
      : pathname.startsWith(`${normalizedBase}/`)
        ? pathname.slice(normalizedBase.length)
        : pathname;

  return (
    spaRelativePath !== '/' &&
    spaRelativePath !== '/login' &&
    !spaRelativePath.startsWith('/login/') &&
    spaRelativePath !== '/logout' &&
    !spaRelativePath.startsWith('/logout/')
  );
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
