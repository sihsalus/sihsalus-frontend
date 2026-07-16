import type { Location, Visit } from '@openmrs/esm-framework/src/internal';
import { resolveFormLocation } from './form-location';

describe('resolveFormLocation', () => {
  const sessionLocation = { uuid: 'hospital-uuid', display: 'Hospital Santa Clotilde' };
  const visitLocation = { uuid: 'upss-uuid', display: 'UPSS - CONSULTA EXTERNA' };

  it('uses the operational visit location when a visit is present', () => {
    expect(resolveFormLocation({ location: visitLocation } as Visit, sessionLocation as Location)).toBe(visitLocation);
  });

  it('falls back to the login location outside a visit', () => {
    expect(resolveFormLocation(undefined, sessionLocation as Location)).toBe(sessionLocation);
  });

  it('does not fall back to the login facility when a visit has no location', () => {
    expect(resolveFormLocation({} as Visit, sessionLocation as Location)).toBeUndefined();
  });
});
