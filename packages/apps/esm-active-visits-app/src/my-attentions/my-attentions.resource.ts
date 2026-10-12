import { openmrsFetch, restBaseUrl, userHasAccess, useSession } from '@openmrs/esm-framework';
import useSWR from 'swr';

export const myAttentionsPrivileges = ['Get Encounters', 'Get Patients', 'Get Visits'];
export const myAttentionsPath = '/home/my-attentions';
export const moduleName = '@sihsalus/esm-active-visits-app';
// MyAttentionsQuery.text: operational search limit, measured in UTF-16 units after trimming.
export const patientQueryMaxLength = 100;
export type AttentionStatus = 'all' | 'open' | 'closed' | 'unlinked';
export interface AttentionFilters {
  from: string;
  through: string;
  q: string;
  status: AttentionStatus;
}
export interface MyAttention {
  id: string;
  patientUuid: string;
  patientName: string;
  identifier: string | null;
  visitUuid: string | null;
  encounterUuid: string;
  visitType: string | null;
  location: string | null;
  status: Exclude<AttentionStatus, 'all'>;
  encounterCount: number;
  lastEncounterDatetime: string;
}
export interface MyAttentionsResponse {
  hasProvider: boolean;
  results: MyAttention[];
  totalCount: number;
  startIndex: number;
  limit: number;
}

export function localDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function dateBounds(from: string, through: string) {
  const parse = (text: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
    const [year, month, day] = text.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return localDate(date) === text ? date : null;
  };
  const start = parse(from);
  const end = parse(through);
  if (!start || !end || end < start) return null;
  end.setDate(end.getDate() + 1);
  if (end.getTime() - start.getTime() > 366 * 86400000) return null;
  return { from: start.toISOString(), until: end.toISOString() };
}

export function myAttentionsUrl(filters: AttentionFilters, page: number, pageSize: number) {
  const bounds = dateBounds(filters.from, filters.through);
  if (!bounds || filters.q.trim().length > patientQueryMaxLength) return null;
  const params = new URLSearchParams({
    ...bounds,
    q: filters.q.trim(),
    status: filters.status,
    startIndex: String((page - 1) * pageSize),
    limit: String(pageSize),
  });
  return `${restBaseUrl}/emrapi/myattentions?${params}`;
}

export function useMyAttentions(filters: AttentionFilters, page: number, pageSize: number) {
  const session = useSession();
  const url = myAttentionsUrl(filters, page, pageSize);
  const allowed = session.authenticated && session.user?.uuid && userHasAccess(myAttentionsPrivileges, session.user);
  return useSWR(
    allowed && url ? [url, session.user.uuid] : null,
    ([requestUrl]: [string, string]) =>
      openmrsFetch<MyAttentionsResponse>(requestUrl).then((response) => response.data),
    { keepPreviousData: false, shouldRetryOnError: false },
  );
}
