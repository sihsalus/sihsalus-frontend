import { userHasAccess } from '@openmrs/esm-framework';

export const companionRegistrationPrivilege = 'app:opciones.registrarAcompanante';

type User = Parameters<typeof userHasAccess>[1] | null | undefined;

export function canSearchCompanionPerson(user: User): boolean {
  return userHasAccess('Get People', user);
}

export function canRegisterCompanionPerson(user: User): boolean {
  return userHasAccess(companionRegistrationPrivilege, user) && userHasAccess('Add People', user);
}
