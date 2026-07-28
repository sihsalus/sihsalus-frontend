import { type BaseOpenmrsData } from '../base-openmrs-data';

export interface UserRoleScopeLocation extends BaseOpenmrsData {
  locationUuid: string;
  locationName: string;
  enableDescendants: boolean;
}
