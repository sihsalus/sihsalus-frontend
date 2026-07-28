import { type BaseOpenmrsData } from '../base-openmrs-data';

export interface UserRoleScopeOperationType extends BaseOpenmrsData {
  operationTypeUuid: string;
  operationTypeName: string;
}
