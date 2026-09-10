import {
  type FetchResponse,
  makeUrl,
  omrsOfflineCachingStrategyHttpHeaderName,
  openmrsFetch,
  restBaseUrl,
} from '@openmrs/esm-framework';
import { isEqual } from 'lodash-es';
import { useCallback, useMemo } from 'react';
import useSWR from 'swr';
import type { FormFields, OpenmrsCondition } from './conditions.types';
import {
  assertConditionIdentifier,
  buildConditionPayload,
  buildConditionUpdatePatch,
  CONDITION_TEXT_MAX_LENGTH,
  isConditionForPatient,
  isConditionResource,
  mapConditionProperties,
  sortConditions,
} from './conditions-model';

export interface ConditionSearchResponse {
  results: Array<OpenmrsCondition>;
  links?: Array<{ rel: string; uri: string }>;
  totalCount?: number;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

function normalizedPageUrl(url: string, base: string, patientUuid: string): string {
  const parsed = new URL(url, base);
  const endpoint = new URL(makeUrl(`${restBaseUrl}/condition`), window.location.href);
  const patientParameters = parsed.searchParams.getAll('patientUuid');
  const inactiveParameters = parsed.searchParams.getAll('includeInactive');
  if (
    !['http:', 'https:'].includes(parsed.protocol) ||
    parsed.username ||
    parsed.password ||
    parsed.pathname !== endpoint.pathname ||
    patientParameters.length > 1 ||
    patientParameters.some((patient) => patient !== patientUuid) ||
    inactiveParameters.length > 1 ||
    inactiveParameters.some((value) => value !== 'true')
  ) {
    throw new Error('Invalid condition pagination link.');
  }
  // REST advertises its own host behind a frontend proxy, as in useOpenmrsPagination.
  parsed.host = window.location.host;
  parsed.protocol = window.location.protocol;
  parsed.hash = '';
  parsed.searchParams.set('patientUuid', patientUuid);
  parsed.searchParams.set('includeInactive', 'true');
  parsed.searchParams.set('v', 'full');
  parsed.searchParams.set('totalCount', 'true');
  if (!parsed.searchParams.has('limit')) parsed.searchParams.set('limit', '100');
  parsed.searchParams.sort();
  return parsed.toString();
}

/** Validate every REST page, including ownership, before exposing a complete history. */
export function createConditionsPageFetcher(patientUuid: string) {
  const links = new Map<string, string | null>();
  return async (key: string): Promise<FetchResponse<ConditionSearchResponse>> => {
    const current = normalizedPageUrl(makeUrl(key), window.location.href, patientUuid);
    const response = await openmrsFetch<unknown>(current, { rejectOnAuthFailure: true });
    const page = response.data;
    if (
      !isRecord(page) ||
      !Array.isArray(page.results) ||
      (page.totalCount !== undefined &&
        (typeof page.totalCount !== 'number' || !Number.isInteger(page.totalCount) || page.totalCount < 0)) ||
      (page.links !== undefined &&
        (!Array.isArray(page.links) ||
          page.links.some((link) => !isRecord(link) || typeof link.rel !== 'string' || typeof link.uri !== 'string')))
    ) {
      throw new Error('Invalid condition search response.');
    }
    for (const condition of page.results) {
      if (!isConditionResource(condition) || condition.voided) {
        throw new Error('Invalid condition in search response.');
      }
      if (!isConditionForPatient(condition, patientUuid)) {
        throw new Error('The condition response does not match the requested patient.');
      }
    }
    const validated = page as unknown as ConditionSearchResponse;
    const nextLinks = validated.links?.filter((link) => link.rel === 'next') ?? [];
    if (nextLinks.length > 1 || (nextLinks.length === 1 && (!nextLinks[0].uri || !validated.results.length))) {
      throw new Error('Invalid condition pagination link.');
    }
    const next = nextLinks[0]?.uri ? normalizedPageUrl(nextLinks[0].uri, current, patientUuid) : null;
    links.set(current, next);
    const visited = new Set<string>([current]);
    let cursor = next;
    while (cursor) {
      if (visited.has(cursor)) {
        links.delete(current);
        throw new Error('The condition history contains a pagination cycle.');
      }
      visited.add(cursor);
      cursor = links.get(cursor) ?? null;
    }
    return {
      ...response,
      data: {
        ...validated,
        links: validated.links?.map((link) => (link.rel === 'next' && next ? { ...link, uri: next } : link)),
      },
    };
  };
}

export function usePatientConditions(patientUuid: string) {
  const query = new URLSearchParams({
    patientUuid,
    includeInactive: 'true',
    v: 'full',
    limit: '100',
    totalCount: 'true',
  });
  const fetcher = useMemo(() => (url: string) => fetchPatientConditions(url, patientUuid), [patientUuid]);
  const url = patientUuid ? `${restBaseUrl}/condition?${query}` : null;
  const {
    data,
    error,
    isLoading,
    isValidating,
    mutate: mutateCache,
  } = useSWR<Array<OpenmrsCondition>, Error>(url, fetcher);
  const mutate = useCallback(async () => {
    if (!url) return;
    // A promise exposes refresh failures to the caller without replacing the last complete snapshot.
    return mutateCache(fetcher(url), { revalidate: false, throwOnError: true });
  }, [url, fetcher, mutateCache]);
  const mapped = useMemo(() => {
    if (!data) return null;
    if (
      data.some(
        (condition) =>
          !isConditionResource(condition) || condition.voided || !isConditionForPatient(condition, patientUuid),
      )
    ) {
      return new Error('The condition response does not match the requested patient.');
    }
    const unique = [...new Map(data.map((condition) => [condition.uuid, condition])).values()];
    return sortConditions(unique.map(mapConditionProperties));
  }, [data, patientUuid]);
  const readError = error ?? (mapped instanceof Error ? mapped : undefined);
  return {
    conditions: !patientUuid ? [] : readError || mapped instanceof Error ? null : mapped,
    error: readError,
    isLoading: Boolean(patientUuid) && !readError && isLoading,
    isValidating: Boolean(patientUuid) && isValidating,
    mutate,
  };
}

/** One SWR value represents all pages; refresh also waits for pages introduced by a write. */
export async function fetchPatientConditions(url: string, patientUuid: string): Promise<Array<OpenmrsCondition>> {
  assertConditionIdentifier(patientUuid);
  const fetchPage = createConditionsPageFetcher(patientUuid);
  const records = new Map<string, OpenmrsCondition>();
  let next: string | undefined = url;
  let total: number | undefined;
  while (next) {
    const response = await fetchPage(next);
    const pageTotal = response.data.totalCount;
    if (total !== undefined && pageTotal !== undefined && pageTotal !== total) {
      throw new Error('The condition history changed while it was loading.');
    }
    total ??= pageTotal;
    const previousCount = records.size;
    for (const condition of response.data.results) records.set(condition.uuid, condition);
    next = response.data.links?.find((link) => link.rel === 'next')?.uri;
    if (next && (records.size === previousCount || (total !== undefined && records.size >= total))) {
      throw new Error('The condition history contains inconsistent pagination.');
    }
  }
  if (total !== undefined && total !== records.size) {
    throw new Error('The condition history is incomplete or changed while it was loading.');
  }
  return [...records.values()];
}

export async function createCondition(payload: FormFields): Promise<FetchResponse<OpenmrsCondition>> {
  return postCondition(`${restBaseUrl}/condition`, buildConditionPayload(payload));
}

export async function updateCondition(conditionId: string, payload: FormFields): Promise<void> {
  const original = payload.originalCondition;
  if (!original) {
    throw new Error('The original condition must be loaded before editing.');
  }
  const body = buildConditionUpdatePatch(conditionId, payload);
  const current = await fetchFreshCondition(conditionId, payload.patientId);
  if (!isEqual(conditionRevision(current), conditionRevision(original))) {
    throw Object.assign(new Error('The antecedent changed after it was loaded.'), { code: 'CONDITION_CHANGED' });
  }
  if (Object.keys(body).length === 0) return;
  await postCondition(`${restBaseUrl}/condition/${conditionId}`, body);
}

export function isUnconfirmedConditionWriteError(error: unknown): boolean {
  return isRecord(error) && error.code === 'CONDITION_WRITE_UNCONFIRMED';
}

async function postCondition(url: string, body: object): Promise<FetchResponse<OpenmrsCondition>> {
  try {
    return await openmrsFetch<OpenmrsCondition>(url, {
      method: 'POST',
      rejectOnAuthFailure: true,
      headers: { 'Content-Type': 'application/json' },
      body,
    });
  } catch (error: unknown) {
    throwConditionWriteError(error);
  }
}

function throwConditionWriteError(error: unknown): never {
  const candidate = isRecord(error) ? error : undefined;
  const response = isRecord(candidate?.response) ? candidate.response : undefined;
  const status = Number(response?.status ?? candidate?.status ?? candidate?.statusCode);
  if (Number.isInteger(status) && status >= 400 && status < 500 && status !== 408) {
    throw error;
  }
  // A lost response or server timeout may follow a committed write; do not make it blindly retryable.
  throw Object.assign(new Error('The condition write could not be confirmed.'), {
    code: 'CONDITION_WRITE_UNCONFIRMED',
  });
}

/** Labels and links depend on locale/representation; persisted clinical and audit identities do not. */
function conditionRevision(condition: OpenmrsCondition) {
  const audit = condition.auditInfo;
  const referenceUuid = (value: unknown) => (isRecord(value) ? value.uuid : null);
  return {
    uuid: condition.uuid,
    patientUuid: condition.patient.uuid,
    voided: condition.voided,
    codedUuid: condition.condition.coded?.uuid ?? null,
    specificNameUuid: condition.condition.specificName?.uuid ?? null,
    nonCoded: condition.condition.nonCoded ?? null,
    clinicalStatus: condition.clinicalStatus,
    verificationStatus: condition.verificationStatus ?? null,
    onsetDate: condition.onsetDate ?? null,
    endDate: condition.endDate ?? null,
    additionalDetail: condition.additionalDetail ?? null,
    previousVersionUuid: condition.previousVersion?.uuid ?? null,
    auditInfo: {
      creatorUuid: referenceUuid(audit?.creator),
      dateCreated: audit?.dateCreated ?? null,
      changedByUuid: referenceUuid(audit?.changedBy),
      dateChanged: audit?.dateChanged ?? null,
      voidedByUuid: referenceUuid(audit?.voidedBy),
      dateVoided: audit?.dateVoided ?? null,
      voidReason: audit?.voidReason ?? null,
    },
  };
}

export async function deleteCondition(conditionId: string, patientUuid: string, reason: string) {
  const normalizedReason = typeof reason === 'string' ? reason.trim() : '';
  if (!normalizedReason || normalizedReason.length > CONDITION_TEXT_MAX_LENGTH) {
    throw new Error('A valid reason is required to remove an antecedent.');
  }
  await fetchFreshCondition(conditionId, patientUuid);
  try {
    return await openmrsFetch(
      `${restBaseUrl}/condition/${conditionId}?reason=${encodeURIComponent(normalizedReason)}`,
      {
        method: 'DELETE',
        rejectOnAuthFailure: true,
      },
    );
  } catch (error: unknown) {
    throwConditionWriteError(error);
  }
}

let freshRequestSequence = 0;
async function fetchFreshCondition(conditionId: string, patientUuid: string): Promise<OpenmrsCondition> {
  assertConditionIdentifier(conditionId);
  assertConditionIdentifier(patientUuid);
  const nonce = `${Date.now()}-${++freshRequestSequence}`;
  const { data } = await openmrsFetch<OpenmrsCondition>(`${restBaseUrl}/condition/${conditionId}?v=full&_=${nonce}`, {
    cache: 'no-store',
    rejectOnAuthFailure: true,
    headers: {
      'Cache-Control': 'no-store',
      [omrsOfflineCachingStrategyHttpHeaderName]: 'network-only-or-cache-only',
    },
  });
  if (
    !isConditionResource(data) ||
    data.voided ||
    data.uuid !== conditionId ||
    !isConditionForPatient(data, patientUuid)
  ) {
    throw new Error('The condition does not belong to the current patient.');
  }
  return data;
}

/** Refresh after a confirmed write, including REST corrections that replace a condition UUID. */
export async function syncConditionCache(mutate: () => Promise<unknown>): Promise<void> {
  await mutate();
}
