import { describe, expect, it } from 'vitest';
import { getDefaultsFromConfigSchema } from '@openmrs/esm-framework';
import { type ConfigObject, configSchema } from '../config-schema';
import { getProgramNavigationHref } from './program-navigation';

describe('program navigation', () => {
  it.each([
    ['b9db5c39-2855-4c61-9f25-9a7ec2d564bc', 'cred-dashboard', 'well-child-care-dashboard'],
    ['3cb4ffd6-1b67-4c52-8398-4bf9844a415e', 'maternal-care-dashboard', 'prenatal-care-dashboard'],
  ])(
    'opens the integrated entry for active %s and its history after completion',
    (programUuid, activePath, historyPath) => {
      globalThis.spaBase = '/openmrs/spa';
      const config = getDefaultsFromConfigSchema(configSchema) as ConfigObject;

      expect(getProgramNavigationHref('patient-uuid', programUuid, config.programNavigationTargets, null)).toBe(
        `/openmrs/spa/patient/patient-uuid/chart/${activePath}`,
      );
      expect(getProgramNavigationHref('patient-uuid', programUuid, config.programNavigationTargets, '2026-10-01')).toBe(
        `/openmrs/spa/patient/patient-uuid/chart/${historyPath}`,
      );
    },
  );

  it.each([undefined, '', '  '])(
    'keeps an implementer target for completed enrollments without a history path (%s)',
    (historicalChartPath) => {
      globalThis.spaBase = '/openmrs/spa';

      expect(
        getProgramNavigationHref(
          'patient-uuid',
          'program-uuid',
          [{ programUuid: 'program-uuid', chartPath: 'Implementer chart', historicalChartPath }],
          '2026-10-01',
        ),
      ).toBe('/openmrs/spa/patient/patient-uuid/chart/Implementer%20chart');
    },
  );

  it('encodes the configured historical path using the same chart path contract', () => {
    globalThis.spaBase = '/openmrs/spa';

    expect(
      getProgramNavigationHref(
        'patient-uuid',
        'program-uuid',
        [{ programUuid: 'program-uuid', chartPath: 'active', historicalChartPath: ' /Care history/Review ' }],
        '2026-10-01',
      ),
    ).toBe('/openmrs/spa/patient/patient-uuid/chart/Care%20history/Review');
  });

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
