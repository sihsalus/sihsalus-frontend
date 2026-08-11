import { isSafeInternalTarget, isSafePostLoginTarget } from './navigation';

describe('isSafeInternalTarget', () => {
  it.each([
    ['https://sihsalus-portal.attacker.tld/', 'an absolute URL that would phish a just-authenticated clinician'],
    ['javascript:fetch("//evil")', 'a javascript: URL that would run in the authenticated origin'],
    ['data:text/html,<script>alert(1)</script>', 'a data: URL'],
    ['//evil.tld/openmrs', 'a protocol-relative URL'],
    ['/\\evil.tld/openmrs', 'a backslash-based cross-origin URL'],
    ['home/dashboard', 'a scheme-less target that is not rooted'],
    [undefined, 'a missing target'],
    [null, 'a null target'],
  ])('rejects %j — %s', (target) => {
    expect(isSafeInternalTarget(target as string | null | undefined)).toBe(false);
  });

  it.each(['/home', '/openmrs/spa/patient/abc/chart', '/login/location?returnToUrl=%2Fhome'])(
    'accepts the same-origin path %j',
    (target) => {
      expect(isSafeInternalTarget(target)).toBe(true);
    },
  );
});

describe('isSafePostLoginTarget', () => {
  it.each([
    '/',
    '/login',
    '/login/',
    '/login/confirm',
    '/login/location?returnToUrl=%2Fhome',
    '/logout',
    '/openmrs/spa',
    '/openmrs/spa/login',
    '/openmrs/spa/login/location',
    '/openmrs/spa/logout',
  ])('rejects the authentication route %j', (target) => {
    expect(isSafePostLoginTarget(target)).toBe(false);
  });

  it.each(['/home', '/patient/abc/chart', '/openmrs/spa/home', '/openmrs/spa/patient/abc/chart'])(
    'accepts the application route %j',
    (target) => {
      expect(isSafePostLoginTarget(target)).toBe(true);
    },
  );
});
