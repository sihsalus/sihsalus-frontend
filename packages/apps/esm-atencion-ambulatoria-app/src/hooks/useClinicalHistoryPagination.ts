import { openmrsFetch, useOpenmrsPagination } from '@openmrs/esm-framework';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useSWR from 'swr';

const CLINICAL_HISTORY_PAGE_SIZE = 10;

const CLINICAL_HISTORY_SOURCE_PAGE_SIZE = 100;

export function useClinicalHistoryPagination<T>(url: string | null) {
  const { data, error, isLoading, isValidating, mutate, currentPage, totalPages, goTo } = useOpenmrsPagination<T>(
    url as string,
    CLINICAL_HISTORY_PAGE_SIZE,
  );

  return {
    data: data ?? [],
    error,
    isLoading,
    isValidating,
    mutate,
    pagination: {
      currentPage,
      totalPages,
      onPageChange: goTo,
    },
  };
}

interface DatedEncounter {
  encounterDatetime: string;
  form?: string | { uuid?: string } | null;
  visit?: string | { uuid?: string; visitType?: string | { uuid?: string } | null } | null;
  uuid?: string;
}

interface OpenmrsEncounterPage<T> {
  results?: Array<T>;
  totalCount?: number;
}

export interface ClinicalHistorySource {
  url: string;
  /** Restricts a generic encounter type to the form that owns this history. */
  expectedFormUuid?: string;
  /** Restricts a generic encounter/form pair to the clinical visit context it belongs to. */
  expectedVisitTypeUuid?: string;
}

export interface EncounterTypeSource {
  encounterTypeUuid: string;
  formUuid?: string;
  visitTypeUuid?: string;
}

export type EncounterTypeSourceInput = string | EncounterTypeSource;

function getEncounterFormUuid(encounter: DatedEncounter): string | undefined {
  return typeof encounter.form === 'string' ? encounter.form : encounter.form?.uuid;
}

function getEncounterVisitTypeUuid(encounter: DatedEncounter): string | undefined {
  if (!encounter.visit || typeof encounter.visit === 'string') return undefined;
  return typeof encounter.visit.visitType === 'string' ? encounter.visit.visitType : encounter.visit.visitType?.uuid;
}

/**
 * Upper bound on server pages crawled per source. A server or proxy that ignores
 * `startIndex` would otherwise loop forever; the cap is far above any realistic
 * patient history and is reported through `truncated` rather than hidden.
 */
const CLINICAL_HISTORY_MAX_SOURCE_PAGES = 20;

function getPaginatedSourceUrl(url: string, startIndex: number): string {
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}limit=${CLINICAL_HISTORY_SOURCE_PAGE_SIZE}&startIndex=${startIndex}&totalCount=true`;
}

function isRelevantToSource(encounter: DatedEncounter, source: ClinicalHistorySource): boolean {
  return (
    (!source.expectedFormUuid || getEncounterFormUuid(encounter) === source.expectedFormUuid) &&
    (!source.expectedVisitTypeUuid || getEncounterVisitTypeUuid(encounter) === source.expectedVisitTypeUuid)
  );
}

export interface ClinicalHistorySourceResult<T> {
  encounters: Array<T>;
  /** True when the page cap stopped the crawl before the history was exhausted. */
  truncated: boolean;
}

/** Fetches every server-side page, up to the page cap, so histories are not silently truncated. */
export async function fetchClinicalHistorySource<T extends DatedEncounter>(
  source: ClinicalHistorySource,
  signal?: AbortSignal,
): Promise<ClinicalHistorySourceResult<T>> {
  const encounters: Array<T> = [];
  let receivedCount = 0;

  for (let page = 0; page < CLINICAL_HISTORY_MAX_SOURCE_PAGES; page++) {
    const response = await openmrsFetch<OpenmrsEncounterPage<T>>(getPaginatedSourceUrl(source.url, receivedCount), {
      signal,
    });
    const results = response?.data?.results ?? [];
    receivedCount += results.length;

    encounters.push(...results.filter((encounter) => isRelevantToSource(encounter, source)));

    // `Number(null)` and `Number('')` are 0, which would end the crawl on the
    // first page; only a genuine number may be treated as the total.
    const rawTotalCount = response?.data?.totalCount;
    const hasTotalCount = typeof rawTotalCount === 'number' && Number.isFinite(rawTotalCount);
    const reachedKnownTotal = hasTotalCount && receivedCount >= rawTotalCount;
    const reachedLastUnknownPage = !hasTotalCount && results.length < CLINICAL_HISTORY_SOURCE_PAGE_SIZE;

    if (!results.length || reachedKnownTotal || reachedLastUnknownPage) {
      return { encounters, truncated: false };
    }
  }

  console.warn(
    `Clinical history crawl stopped at the ${CLINICAL_HISTORY_MAX_SOURCE_PAGES}-page cap; results may be incomplete.`,
    source.url,
  );
  return { encounters, truncated: true };
}

export interface ClinicalHistorySourcesResult<T> {
  encounters: Array<T>;
  /** Reasons the sources that could not be read failed; empty when all succeeded. */
  sourceErrors: Array<Error>;
  truncated: boolean;
}

export async function fetchClinicalHistorySources<T extends DatedEncounter>(
  sources: Array<ClinicalHistorySource>,
  signal?: AbortSignal,
): Promise<ClinicalHistorySourcesResult<T>> {
  const results = await Promise.allSettled(sources.map((source) => fetchClinicalHistorySource<T>(source, signal)));
  const fulfilled = results.filter(
    (result): result is PromiseFulfilledResult<ClinicalHistorySourceResult<T>> => result.status === 'fulfilled',
  );

  // A secondary encounter type may be absent from a deployment or unreadable by
  // this role. Losing it must degrade the history, never blank it: only fail when
  // nothing could be read at all.
  const sourceErrors = results
    .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
    .map((result) => (result.reason instanceof Error ? result.reason : new Error(String(result.reason))));

  if (sources.length > 0 && fulfilled.length === 0) {
    throw sourceErrors[0] ?? new Error('The clinical history could not be loaded.');
  }

  if (sourceErrors.length) {
    console.warn('Some clinical history sources could not be loaded; showing partial history.', sourceErrors);
  }

  const byUuid = new Map<string, T>();
  fulfilled
    .flatMap((result) => result.value.encounters)
    .forEach((encounter, index) => {
      byUuid.set(encounter.uuid ?? `${encounter.encounterDatetime}-${index}`, encounter);
    });

  return {
    encounters: [...byUuid.values()],
    sourceErrors,
    truncated: fulfilled.some((result) => result.value.truncated),
  };
}

/**
 * Reads the clinical history across several encounter types (e.g. Consulta
 * Externa plus the manual visit-note workspace, which records the same clinical
 * subdomains under a different encounter type). The REST encounter search only
 * accepts one encounterType per request, so each source is fetched separately,
 * merged, sorted by date and paginated client-side with the same pagination
 * shape as {@link useClinicalHistoryPagination}.
 */
export function useMergedClinicalHistoryPagination<T extends DatedEncounter>(
  sources: Array<ClinicalHistorySource> | null,
  isRelevant?: (encounter: T) => boolean,
) {
  const sourceKey = JSON.stringify(sources ?? []);
  const [paginationState, setPaginationState] = useState({ sourceKey, currentPage: 1 });
  const currentPage = paginationState.sourceKey === sourceKey ? paginationState.currentPage : 1;

  useEffect(() => {
    setPaginationState((state) => (state.sourceKey === sourceKey ? state : { sourceKey, currentPage: 1 }));
  }, [sourceKey]);

  // The crawl can span many requests, so it is aborted when this hook stops caring
  // about the current sources (patient switch, tab change, unmount).
  const abortControllerRef = useRef<AbortController | null>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: sourceKey intentionally aborts the in-flight crawl when the sources change
  useEffect(() => {
    return () => abortControllerRef.current?.abort();
  }, [sourceKey]);

  const { data, error, isLoading, isValidating, mutate } = useSWR(
    sources?.length ? sources : null,
    (key: Array<ClinicalHistorySource>) => {
      abortControllerRef.current?.abort();
      const abortController = new AbortController();
      abortControllerRef.current = abortController;
      return fetchClinicalHistorySources<T>(key, abortController.signal);
    },
  );

  const encounters = data?.encounters;
  const relevantData = useMemo(
    () => (isRelevant ? (encounters ?? []).filter(isRelevant) : (encounters ?? [])),
    [encounters, isRelevant],
  );
  const sortedData = useMemo(
    () =>
      [...relevantData].sort(
        (a, b) => new Date(b.encounterDatetime).getTime() - new Date(a.encounterDatetime).getTime(),
      ),
    [relevantData],
  );

  const totalPages = Math.max(1, Math.ceil(sortedData.length / CLINICAL_HISTORY_PAGE_SIZE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pageData = useMemo(
    () =>
      sortedData.slice(
        (safeCurrentPage - 1) * CLINICAL_HISTORY_PAGE_SIZE,
        safeCurrentPage * CLINICAL_HISTORY_PAGE_SIZE,
      ),
    [sortedData, safeCurrentPage],
  );

  const onPageChange = useCallback((page: number) => setPaginationState({ sourceKey, currentPage: page }), [sourceKey]);

  return {
    data: pageData,
    error,
    isLoading,
    isValidating,
    mutate,
    /** Sources that failed while others succeeded — the history shown is partial. */
    sourceErrors: data?.sourceErrors ?? [],
    truncated: data?.truncated ?? false,
    pagination: {
      currentPage: safeCurrentPage,
      totalPages,
      onPageChange,
    },
  };
}

/** Normalizes encounter types and optional form restrictions into de-duplicated sources. */
export function toEncounterTypeSources(
  encounterType: EncounterTypeSourceInput | Array<EncounterTypeSourceInput> | undefined | null,
): Array<EncounterTypeSource> {
  const values = Array.isArray(encounterType) ? encounterType : [encounterType];
  const normalized = values
    .filter((value): value is EncounterTypeSourceInput => Boolean(value))
    .map((value) => (typeof value === 'string' ? { encounterTypeUuid: value } : value))
    .filter((value) => Boolean(value.encounterTypeUuid));
  return [
    ...new Map(
      normalized.map((value) => [
        `${value.encounterTypeUuid}:${value.formUuid ?? ''}:${value.visitTypeUuid ?? ''}`,
        value,
      ]),
    ).values(),
  ];
}

/** Backwards-compatible UUID-only normalizer. */
export function toEncounterTypeUuids(encounterType: string | Array<string> | undefined | null): Array<string> {
  return toEncounterTypeSources(encounterType).map((source) => source.encounterTypeUuid);
}
