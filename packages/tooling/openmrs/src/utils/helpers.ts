import { createHash } from 'node:crypto';

export function trimEnd(text: string, chr: string): string {
  while (text.endsWith(chr)) {
    text = text.slice(0, text.length - chr.length);
  }
  return text;
}

export function removeTrailingSlash(path: string): string {
  return path.replace(/\/+$/, '');
}

export function isSpaIndexRequestPath(requestPath: string, spaPath: string): boolean {
  const normalizedSpaPath = removeTrailingSlash(spaPath);
  const pathname = (() => {
    try {
      return new URL(requestPath, 'http://localhost').pathname;
    } catch {
      return requestPath.split(/[?#]/)[0];
    }
  })();

  if (pathname === normalizedSpaPath || pathname === `${normalizedSpaPath}/`) {
    return true;
  }
  if (!pathname.startsWith(`${normalizedSpaPath}/`)) {
    return false;
  }

  const lastSegment = pathname.slice(pathname.lastIndexOf('/') + 1);
  return !lastSegment.includes('.');
}

export function contentHash(obj: object) {
  return createHash('sha1').update(JSON.stringify(obj)).digest('hex');
}

const selfSignedTlsDefaultHosts = new Set(['gidis-hsc-dev.inf.pucp.edu.pe', 'gidis-hsc-qlty.inf.pucp.edu.pe']);

export function shouldAllowSelfSignedTls(
  backend: string,
  configuredValue = process.env.SIHSALUS_ALLOW_SELF_SIGNED_TLS,
) {
  let backendUrl: URL;
  try {
    backendUrl = new URL(backend);
  } catch {
    return false;
  }
  if (backendUrl.protocol !== 'https:') {
    return false;
  }

  if (configuredValue === 'true') {
    return true;
  }
  if (configuredValue === 'false') {
    return false;
  }

  return selfSignedTlsDefaultHosts.has(backendUrl.hostname);
}
