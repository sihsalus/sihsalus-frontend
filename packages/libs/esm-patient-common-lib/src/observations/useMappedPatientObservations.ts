import { type FetchResponse, type FHIRResource, fhirBaseUrl, openmrsFetch } from '@openmrs/esm-framework';
import { useCallback, useMemo } from 'react';
import useSWRInfinite from 'swr/infinite';

const defaultPageSize = 100;

export interface PatientObservationBaseRow {
  id: string;
  date: string;
}

export interface PatientObservationRow extends PatientObservationBaseRow {
  [key: string]: string | number | null | undefined;
}

export interface PatientObservationRecord {
  code: string;
  encounterId: string;
  key: string;
  recordedDate: string;
  resource: FHIRResource['resource'];
  value: number | string;
}

export interface PatientObservationsResponse {
  entry: Array<{
    resource: FHIRResource['resource'];
  }>;
  link: Array<{ relation: string; url: string }>;
  total: number;
}

type PatientObservationsFetchResponse = FetchResponse<PatientObservationsResponse>;

interface PatientObservationsSwrKey {
  conceptUuids: string;
  page: number;
  pageSize: number;
  patientUuid: string;
  prevPageData: PatientObservationsFetchResponse;
}

interface UseMappedPatientObservationsOptions<Row extends PatientObservationBaseRow> {
  conceptUuids: Array<string | null | undefined>;
  finalizeRow?: (row: Row) => Row;
  getObservationFields?: (record: PatientObservationRecord) => Partial<Row>;
  getObservationKey: (conceptUuid: string) => string | null | undefined;
  pageSize?: number;
  patientUuid: string;
}

function fetchPatientObservations({
  patientUuid,
  conceptUuids,
  page,
  pageSize,
  prevPageData,
}: PatientObservationsSwrKey) {
  if (prevPageData && !prevPageData?.data?.link?.some((link) => link.relation === 'next')) {
    return null;
  }

  const url = `${fhirBaseUrl}/Observation?subject:Patient=${patientUuid}&`;
  const urlSearchParams = new URLSearchParams();

  urlSearchParams.append('code', conceptUuids);
  urlSearchParams.append('_summary', 'data');
  urlSearchParams.append('_sort', '-date');
  urlSearchParams.append('_count', pageSize.toString());

  if (page) {
    urlSearchParams.append('_getpagesoffset', (page * pageSize).toString());
  }

  return openmrsFetch<PatientObservationsResponse>(url + urlSearchParams.toString());
}

export function useMappedPatientObservations<Row extends PatientObservationBaseRow = PatientObservationRow>({
  conceptUuids,
  finalizeRow,
  getObservationFields,
  getObservationKey,
  pageSize = defaultPageSize,
  patientUuid,
}: UseMappedPatientObservationsOptions<Row>) {
  const conceptUuidList = useMemo(() => conceptUuids.filter(Boolean).join(','), [conceptUuids]);

  const getPage = useCallback(
    (page: number, prevPageData: PatientObservationsFetchResponse): PatientObservationsSwrKey | null => {
      if (!patientUuid || !conceptUuidList) {
        return null;
      }

      return {
        conceptUuids: conceptUuidList,
        page,
        pageSize,
        patientUuid,
        prevPageData,
      };
    },
    [conceptUuidList, pageSize, patientUuid],
  );

  const { data, isLoading, isValidating, setSize, error, size, mutate } = useSWRInfinite<
    PatientObservationsFetchResponse,
    Error
  >(getPage, fetchPatientObservations);

  const mappedRows = useMemo(() => {
    const groupedRows = new Map<string, { date: string; fields: Partial<Row> }>();

    data?.forEach((page) => {
      page?.data?.entry
        ?.map((entry) => entry.resource)
        .filter(Boolean)
        .forEach((resource) => {
          const code = resource?.code?.coding?.[0]?.code;
          const key = code ? getObservationKey(code) : undefined;
          const recordedDate = resource?.effectiveDateTime;
          const value =
            resource?.valueQuantity?.value ??
            resource?.valueString ??
            resource?.valueCodeableConcept?.coding?.[0]?.display ??
            resource?.valueCodeableConcept?.coding?.[0]?.code;

          if (!code || !key || !recordedDate || value == null) {
            return;
          }

          const recordedDateString = String(recordedDate);
          const date = new Date(recordedDateString).toISOString();
          const encounterId = resource?.encounter?.reference?.split('/')?.pop() ?? '';
          const record: PatientObservationRecord = {
            code,
            encounterId,
            key,
            recordedDate: recordedDateString,
            resource,
            value,
          };

          // One row per encounter, so observations saved seconds apart in the same
          // encounter never split and simultaneous encounters never merge. Observations
          // without an encounter reference fall back to grouping by exact timestamp.
          const groupKey = encounterId || date;
          const existing = groupedRows.get(groupKey);
          groupedRows.set(groupKey, {
            date: existing?.date ?? date,
            fields: {
              ...existing?.fields,
              ...(getObservationFields?.(record) ?? ({ [key]: value } as Partial<Row>)),
            },
          });
        });
    });

    return Array.from(groupedRows).map(([groupKey, { date, fields }]) => {
      const mappedRow = {
        id: groupKey,
        date,
        ...fields,
      } as Row;

      return finalizeRow?.(mappedRow) ?? mappedRow;
    });
  }, [data, finalizeRow, getObservationFields, getObservationKey]);

  return {
    data: data ? mappedRows : undefined,
    error,
    hasMore: data?.length ? !!data[data.length - 1]?.data?.link?.some((link) => link.relation === 'next') : false,
    isLoading,
    isValidating,
    loadingNewData: isValidating,
    setPage: setSize,
    currentPage: size,
    totalResults: data?.[0]?.data?.total ?? undefined,
    mutate,
  };
}
