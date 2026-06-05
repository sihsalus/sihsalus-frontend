import { describe, expect, it } from 'vitest';

import { shouldAllowSelfSignedTls } from './helpers';

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
  });
});
