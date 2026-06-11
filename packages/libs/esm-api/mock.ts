import { createGlobalStore } from '@openmrs/esm-state/mock';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { type SessionStore } from './src/current-user';

export const setSessionLocation = vi.fn(() => Promise.resolve());
export const openmrsFetch = vi.fn((_url?: string) => new Promise(() => {}));
export const openmrsObservableFetch = vi.fn(() => of({ data: { entry: [] } }));
export function getCurrentUser() {
  return of({ authenticated: false });
}
export const mockSessionStore = createGlobalStore<SessionStore>('mock-session-store', {
  loaded: false,
  session: null,
});
export const getSessionStore = vi.fn(() => mockSessionStore);
export const restBaseUrl = '/ws/rest/v1';
export const fhirBaseUrl = '/ws/fhir2/R4';
export const clearCurrentUser = vi.fn();
export const refetchCurrentUser = vi.fn();
export const setUserLanguage = vi.fn();
export const setUserProperties = vi.fn();
export const userHasAccess = vi.fn(
  (
    requiredPrivilege: string | Array<string> | undefined,
    user?: { privileges?: Array<{ display?: string; name?: string }> } | null,
  ) => {
    if (!requiredPrivilege) {
      return true;
    }
    const userPrivileges = (user?.privileges ?? []).map((privilege) => privilege?.display ?? privilege?.name);
    const required = Array.isArray(requiredPrivilege) ? requiredPrivilege : [requiredPrivilege];
    return required.every((privilege) => userPrivileges.includes(privilege));
  },
);
