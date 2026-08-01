import {
  type FetchResponse,
  openmrsFetch,
  restBaseUrl,
  userHasAccessToRequiredPrivilege,
  useSession,
} from '@openmrs/esm-framework';
import useSWR from 'swr';

import { clinicalFormsEditPrivilege, clinicalFormsViewPrivilege, customFormRepresentation } from '../constants';
import type { Form, Privilege } from '../types';

function resolvePrivilege(privilege: Privilege | null | undefined, fallback: string): string {
  if (privilege === null || privilege === undefined) {
    return fallback;
  }

  return privilege.display ?? privilege.name;
}

export function getRequiredFormEditPrivilege(form: Form): string {
  return resolvePrivilege(form.encounterType?.editPrivilege, clinicalFormsEditPrivilege);
}

export function getRequiredFormViewPrivilege(form: Form): string {
  return resolvePrivilege(form.encounterType?.viewPrivilege, clinicalFormsViewPrivilege);
}

export function useFormAccess(formUuid?: string, suppliedForm?: Form) {
  const session = useSession();
  const shouldFetch = Boolean(!suppliedForm && formUuid && session?.authenticated && session.user);
  const url = shouldFetch ? `${restBaseUrl}/form/${formUuid}?v=custom:${customFormRepresentation}` : null;
  const { data, error, isLoading } = useSWR<FetchResponse<Form>>(url, openmrsFetch);
  const form = suppliedForm ?? data?.data;

  return {
    canEdit: Boolean(form && userHasAccessToRequiredPrivilege(getRequiredFormEditPrivilege(form), session?.user)),
    canView: Boolean(form && userHasAccessToRequiredPrivilege(getRequiredFormViewPrivilege(form), session?.user)),
    error,
    form,
    isLoading,
  };
}
