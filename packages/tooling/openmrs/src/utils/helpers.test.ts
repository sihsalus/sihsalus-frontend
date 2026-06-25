import { describe, expect, it } from 'vitest';

import { isSpaIndexRequestPath, shouldAllowSelfSignedTls } from './helpers';

describe('isSpaIndexRequestPath', () => {
  it('matches SPA route requests under the configured spa path', () => {
    expect(isSpaIndexRequestPath('/openmrs/spa', '/openmrs/spa')).toBe(true);
    expect(isSpaIndexRequestPath('/openmrs/spa/', '/openmrs/spa')).toBe(true);
    expect(isSpaIndexRequestPath('/openmrs/spa/home', '/openmrs/spa')).toBe(true);
    expect(isSpaIndexRequestPath('/openmrs/spa/home/fua-request?dashboard=true', '/openmrs/spa')).toBe(true);
  });

  it('does not match static assets emitted by Rspack', () => {
    expect(isSpaIndexRequestPath('/openmrs/spa/a8956bd8417742d8.svg', '/openmrs/spa')).toBe(false);
    expect(isSpaIndexRequestPath('/openmrs/spa/login.avif', '/openmrs/spa')).toBe(false);
    expect(isSpaIndexRequestPath('/openmrs/spa/manifest.webmanifest', '/openmrs/spa')).toBe(false);
    expect(isSpaIndexRequestPath('/openmrs/spa/esm-home-204-59a8e654.js', '/openmrs/spa')).toBe(false);
  });

  it('does not match paths outside the configured spa path', () => {
    expect(isSpaIndexRequestPath('/openmrs/ws/rest/v1/session', '/openmrs/spa')).toBe(false);
  });
});

describe('shouldAllowSelfSignedTls', () => {
  it('allows self-signed TLS by default for internal SIH Salus backends', () => {
    expect(shouldAllowSelfSignedTls('https://gidis-hsc-dev.inf.pucp.edu.pe')).toBe(true);
    expect(shouldAllowSelfSignedTls('https://gidis-hsc-qlty.inf.pucp.edu.pe')).toBe(true);
  });

  it('keeps strict TLS by default for unknown or non-HTTPS backends', () => {
    expect(shouldAllowSelfSignedTls('https://example.org')).toBe(false);
    expect(shouldAllowSelfSignedTls('http://gidis-hsc-qlty.inf.pucp.edu.pe')).toBe(false);
  });

  it('lets the environment variable override the backend default', () => {
    expect(shouldAllowSelfSignedTls('https://gidis-hsc-qlty.inf.pucp.edu.pe', 'false')).toBe(false);
    expect(shouldAllowSelfSignedTls('https://example.org', 'true')).toBe(true);
    expect(shouldAllowSelfSignedTls('http://gidis-hsc-qlty.inf.pucp.edu.pe', 'true')).toBe(false);
  });
});
