import { isVersionSatisfied } from '@openmrs/esm-utils';
import routes from './routes.json';

describe('O3 Forms backend version contract', () => {
  it('preserves the upstream minimum without an exception for the rejected patch', () => {
    expect(routes.backendDependencies.o3forms).toBe('>=2.3.0');
  });

  it('uses the real version comparator instead of the framework test stub', () => {
    expect(vi.isMockFunction(isVersionSatisfied)).toBe(false);
    expect(isVersionSatisfied('>=2.3.0', '2.3.0-sihsalus.1')).toBe(false);
  });

  it.each([
    '2.3.0',
    '2.3.1',
    '2.3.1-sihsalus.1',
    '2.4.0',
    '3.0.0',
  ])('accepts the compatible installed version %s', (version) => {
    expect(isVersionSatisfied(routes.backendDependencies.o3forms, version)).toBe(true);
  });

  it.each([
    '2.2.9',
    '2.3.0-SNAPSHOT',
    '2.3.0-rc.1',
    '2.3.0-sihsalus.1',
    '2.3.0-sihsalus.2',
    '2.3.0-sihsalus.10',
    '2.3.0-other.1',
    'invalid',
  ])('does not admit the below-minimum or invalid installed version %s', (version) => {
    expect(isVersionSatisfied(routes.backendDependencies.o3forms, version)).toBe(false);
  });

  it('preserves the unrelated FHIR2 and REST requirements', () => {
    expect(routes.backendDependencies.fhir2).toBe('>=1.2');
    expect(routes.backendDependencies['webservices.rest']).toBe('>=2.24.0');
  });
});
