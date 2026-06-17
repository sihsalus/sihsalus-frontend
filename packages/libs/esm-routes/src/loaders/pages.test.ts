import { describe, expect, it } from 'vitest';

import { getAvailableFeatureFlags } from './pages';

describe('getAvailableFeatureFlags', () => {
  it('includes feature flags declared by optional backend dependencies', () => {
    expect(
      getAvailableFeatureFlags({
        optionalBackendDependencies: {
          emrapi: {
            version: '>=2.0.0',
            feature: {
              flagName: 'emrapi-module',
              label: 'EMR API Module',
              description: 'This module, if installed, provides core EMR business logic.',
            },
          },
          ordertemplates: {
            version: '^1.0.2 || ^2.0.0',
            feature: {
              flagName: 'ordertemplates-module',
              label: 'Order Templates',
              description:
                'Enable support for order templates when ordering drugs. Requires the backend ordertemplates module.',
            },
          },
          fhirproxy: '>=1.0.0',
        },
        featureFlags: [
          {
            flagName: 'patient-flags',
            label: 'Patient flags',
            description: 'Shows patient flags.',
          },
        ],
      }).map((flag) => flag.flagName),
    ).toEqual(['emrapi-module', 'ordertemplates-module', 'patient-flags']);
  });
});
