import { userHasAccess } from '@openmrs/esm-framework';
import { clinicalChartPrivilege } from './constants';

type NamedResource = {
  readonly name?: string;
  readonly display?: string;
};

type ClinicalChartAccessUser = {
  readonly privileges: ReadonlyArray<NamedResource>;
  readonly roles: ReadonlyArray<NamedResource>;
};

export function hasClinicalChartAccess(user: ClinicalChartAccessUser | null | undefined): boolean {
  if (!user) {
    return false;
  }

  return userHasAccess(clinicalChartPrivilege, user as Parameters<typeof userHasAccess>[1]);
}
