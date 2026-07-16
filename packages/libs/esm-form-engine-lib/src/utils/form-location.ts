import type { Location, Visit } from '@openmrs/esm-framework/src/internal';

export function resolveFormLocation(
  visit: Visit | undefined,
  sessionLocation: Location | undefined,
): Location | undefined {
  return visit ? visit.location : sessionLocation;
}
