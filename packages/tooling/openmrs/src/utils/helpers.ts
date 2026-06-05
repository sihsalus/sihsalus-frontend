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

export function contentHash(obj: object) {
  return createHash('sha1').update(JSON.stringify(obj)).digest('hex');
}

const selfSignedTlsDefaultHosts = new Set(['gidis-hsc-dev.inf.pucp.edu.pe', 'gidis-hsc-qlty.inf.pucp.edu.pe']);

export function shouldAllowSelfSignedTls(
  backend: string,
  configuredValue = process.env.SIHSALUS_ALLOW_SELF_SIGNED_TLS,
) {
  if (configuredValue === 'true') {
    return true;
  }
  if (configuredValue === 'false') {
    return false;
  }

  try {
    const backendUrl = new URL(backend);
    return backendUrl.protocol === 'https:' && selfSignedTlsDefaultHosts.has(backendUrl.hostname);
  } catch {
    return false;
  }
}
