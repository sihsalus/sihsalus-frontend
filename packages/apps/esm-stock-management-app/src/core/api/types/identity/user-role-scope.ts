import { type BaseOpenmrsData } from '../base-openmrs-data';
import { type UserRoleScopeLocation } from './user-role-scope-location';
import { type UserRoleScopeOperationType } from './user-role-scope-operation-type';

export interface UserRoleScope extends BaseOpenmrsData {
  userUuid?: string;
  role?: string;
  userName?: string;
  userGivenName?: string;
  userFamilyName?: string;
  permanent: boolean;
  activeFrom?: Date;
  activeTo?: Date;
  enabled: boolean;
  locations: UserRoleScopeLocation[];
  operationTypes: UserRoleScopeOperationType[];
}
