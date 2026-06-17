import { describe, expect, it } from 'vitest';
import { getProgramNavigationHref } from './program-navigation';

describe('program navigation', () => {
  it('builds patient chart links for configured program targets', () => {
    globalThis.spaBase = '/openmrs/spa';

    expect(
      getProgramNavigationHref('patient-uuid', 'program-uuid', [
        {
          programUuid: 'program-uuid',
          chartPath: 'well-child-care-dashboard',
        },
      ]),
    ).toBe('/openmrs/spa/patient/patient-uuid/chart/well-child-care-dashboard');
  });

  it('encodes chart path segments and ignores unconfigured programs', () => {
    globalThis.spaBase = '/openmrs/spa';

    expect(
      getProgramNavigationHref('patient-uuid', 'program-uuid', [
        {
          programUuid: 'program-uuid',
          chartPath: 'Patient Summary',
        },
      ]),
    ).toBe('/openmrs/spa/patient/patient-uuid/chart/Patient%20Summary');

    expect(getProgramNavigationHref('patient-uuid', 'other-program', [])).toBeNull();
  });
});
