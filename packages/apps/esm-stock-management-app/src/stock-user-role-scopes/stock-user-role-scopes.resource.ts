import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import useSWR from 'swr';
import { type ResourceFilterCriteria, toQueryParams } from '../core/api/api';
import { type UserRoleScope } from '../core/api/types/identity/UserRoleScope';
import { type PageableResult } from '../core/api/types/PageableResult';

export type UserRoleScopeFilter = ResourceFilterCriteria;

// getUserRoleScopes
export function useUserRoleScopes(filter: UserRoleScopeFilter) {
  const apiUrl = `${restBaseUrl}/stockmanagement/userrolescope${toQueryParams(filter)}`;
  const { data, error, isLoading } = useSWR<{ data: PageableResult<UserRoleScope> }, Error>(apiUrl, openmrsFetch);
  return {
    items: data?.data || <PageableResult<UserRoleScope>>{},
    isLoading,
    error,
  };
}

// getUserRoleScope
export function useUserRoleScope(id: string) {
  const apiUrl = `${restBaseUrl}/stockmanagement/userrolescope/${id}`;
  const { data, error, isLoading } = useSWR<{ data: UserRoleScope }, Error>(apiUrl, openmrsFetch);
  return {
    items: data.data ? data.data : {},
    isLoading,
    error,
  };
}

// deleteUserRoleScopes
export function deleteUserRoleScopes(ids: string[]) {
  let otherIds = ids.reduce((p, c, i) => {
    if (i === 0) return p;
    p += (p.length > 0 ? ',' : '') + encodeURIComponent(c);
    return p;
  }, '');
  if (otherIds.length > 0) {
    otherIds = '?ids=' + otherIds;
  }
  const apiUrl = `${restBaseUrl}/stockmanagement/userrolescope/${ids[0]}${otherIds}`;
  const abortController = new AbortController();

  return openmrsFetch(apiUrl, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
    signal: abortController.signal,
  });
}

function normalizeUserRoleScopePayload(item: UserRoleScope): UserRoleScope {
  return {
    ...item,
    enabled: item?.enabled ?? true,
    permanent: item?.permanent ?? true,
    locations: (item?.locations ?? []).map((location) => ({
      ...location,
      enableDescendants: location?.enableDescendants ?? false,
    })),
    operationTypes: item?.operationTypes ?? [],
  };
}

// createOrUpdateUserRoleScope
export function createOrUpdateUserRoleScope(item: UserRoleScope) {
  const payload = normalizeUserRoleScopePayload(item);
  const abortController = new AbortController();
  const hasUuid = payload.uuid != null;
  const apiUrl = `${restBaseUrl}/stockmanagement/userrolescope${hasUuid ? '/' + payload.uuid : ''}`;
  return openmrsFetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    signal: abortController.signal,
    body: payload,
  });
}
