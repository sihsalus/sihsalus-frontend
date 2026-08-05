import { openmrsFetch, useOpenmrsPagination } from '@openmrs/esm-framework';
import { useCallback, useEffect, useMemo, useState } from 'react';
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
  visit?: string | { visitType?: string | { uuid?: string } | null } | null;
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

function getPaginatedSourceUrl(url: string, startIndex: number): string {
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}limit=${CLINICAL_HISTORY_SOURCE_PAGE_SIZE}&startIndex=${startIndex}&totalCount=true`;
}

/** Fetches every server-side page so merged histories are never silently truncated. */
export async function fetchClinicalHistorySource<T extends DatedEncounter>(source: ClinicalHistorySource) {
  const encounters: Array<T> = [];
  let receivedCount = 0;

  while (true) {
    const response = await openmrsFetch<OpenmrsEncounterPage<T>>(getPaginatedSourceUrl(source.url, receivedCount));
    const results = response?.data?.results ?? [];
    receivedCount += results.length;

    encounters.push(
      ...results.filter(
        (encounter) =>
          (!source.expectedFormUuid || getEncounterFormUuid(encounter) === source.expectedFormUuid) &&
          (!source.expectedVisitTypeUuid || getEncounterVisitTypeUuid(encounter) === source.expectedVisitTypeUuid),
      ),
    );

    const totalCount = Number(response?.data?.totalCount);
    const reachedKnownTotal = Number.isFinite(totalCount) && receivedCount >= totalCount;
    const reachedLastUnknownPage = !Number.isFinite(totalCount) && results.length < CLINICAL_HISTORY_SOURCE_PAGE_SIZE;
    if (!results.length || reachedKnownTotal || reachedLastUnknownPage) {
      return encounters;
    }
  }
}

export async function fetchClinicalHistorySources<T extends DatedEncounter>(sources: Array<ClinicalHistorySource>) {
  const results = await Promise.allSettled(sources.map((source) => fetchClinicalHistorySource<T>(source)));
  const successfulSources = results.filter(
    (result): result is PromiseFulfilledResult<Array<T>> => result.status === 'fulfilled',
  );
  if (successfulSources.length !== results.length) {
    const firstFailure = results.find((result): result is PromiseRejectedResult => result.status === 'rejected');
    throw firstFailure?.reason instanceof Error
      ? firstFailure.reason
      : new Error('One or more clinical history sources could not be loaded.');
  }
  const byUuid = new Map<string, T>();
  successfulSources
    .flatMap((result) => result.value)
    .forEach((encounter, index) => {
      byUuid.set(encounter.uuid ?? `${encounter.encounterDatetime}-${index}`, encounter);
    });
  return [...byUuid.values()];
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

  const { data, error, isLoading, isValidating, mutate } = useSWR(
    sources?.length ? sources : null,
    fetchClinicalHistorySources<T>,
  );

  const relevantData = useMemo(() => (isRelevant ? (data ?? []).filter(isRelevant) : (data ?? [])), [data, isRelevant]);
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
