import type { FetchResponse } from '@openmrs/esm-framework';
import { openmrsFetch, openmrsObservableFetch } from '@openmrs/esm-framework';
import dayjs from 'dayjs';
import { useEffect, useState } from 'react';
import { type Observable } from 'rxjs';
import useSWR from 'swr';

import type { ReportDefinition } from '../types/report-definition';
import type { ReportDesign } from '../types/report-design';
import type { ReportRequest } from '../types/report-request';

interface ReportModel {
  reportName: string;
  status: string;
  requestedBy: string;
  requestedByUserUuid: string;
  requestedOn: string;
  outputFormat: string;
  parameters: string;
  id: string;
  evaluateCompleteDatetime: string;
  schedule: string;
}

export interface ScheduledReportModel {
  reportDefinitionUuid: string;
  reportRequestUuid: string;
  name: string;
  schedule: string;
}

export function useLocations() {
  const apiUrl = `/ws/rest/v1/location?tag=Login+Location`;

  const { data } = useSWR<{ data: { results: Array<{ uuid: string; display: string }> } }, Error>(apiUrl, openmrsFetch);

  return {
    locations: data ? data?.data?.results : [],
  };
}

export function useReports(statuses: string, pageNumber: number, pageSize: number, sortBy?: string) {
  const reportsUrl =
    `/ws/rest/v1/reportingrest/reportRequest?status=${statuses}&startIndex=${pageNumber}&limit=${pageSize}&totalCount=true` +
    (sortBy ? `&sortBy=${sortBy}` : '');

  const { data, error, isValidating, mutate } = useSWR<
    { data: { results: Array<Record<string, unknown>>; totalCount: number } },
    Error
  >(reportsUrl, openmrsFetch);

  const reports = data?.data?.results;
  const totalCount = data?.data?.totalCount;
  const reportsArray: Array<ReportModel> = reports
    ? [].concat(...reports.map((report) => mapReportResults(report)))
    : [];

  return {
    reports: reportsArray,
    reportsTotalCount: totalCount,
    error,
    isValidating: isValidating,
    mutateReports: mutate,
  };
}

export function useReportRequest(reportRequestUuid: string) {
  const reportsUrl = `/ws/rest/v1/reportingrest/reportRequest/${reportRequestUuid}`;

  const { data, error, isValidating, mutate } = useSWR<{ data: ReportRequest }, Error>(reportsUrl, openmrsFetch);

  return {
    reportRequest: data?.data,
    error,
    isValidating: isValidating,
    mutate,
  };
}

export function useScheduledReports(sortBy?: string) {
  const scheduledReportsUrl =
    `/ws/rest/v1/reportingrest/reportDefinitionsWithScheduledRequests` + (sortBy ? `?sortBy=${sortBy}` : '');

  const { data, error, isValidating, mutate } = useSWR<{ data: { results: Array<Record<string, unknown>> } }, Error>(
    scheduledReportsUrl,
    openmrsFetch,
  );

  const scheduledReports = data?.data?.results;
  const scheduledReportsArray: Array<ScheduledReportModel> = scheduledReports
    ? [].concat(...scheduledReports.map((report) => mapScheduledReportResults(report)))
    : [];

  return {
    scheduledReports: scheduledReportsArray,
    error,
    isValidating: isValidating,
    mutateScheduledReports: mutate,
  };
}

export function useReportDefinitions() {
  const apiUrl = `/ws/rest/v1/reportingrest/reportDefinition?v=full`;

  const { data } = useSWR<{ data: { results: Array<ReportDefinition> } }, Error>(apiUrl, openmrsFetch);

  return {
    reportDefinitions: data ? data?.data?.results : [],
  };
}

export function useReportDefinition(reportDefinitionUuid: string): ReportDefinition {
  const apiUrl = `/ws/rest/v1/reportingrest/reportDefinition/${reportDefinitionUuid}?v=full`;

  const { data } = useSWR<{ data: ReportDefinition }, Error>(apiUrl, openmrsFetch);

  return data?.data;
}

export function useReportDesigns(reportDefinitionUuid: string) {
  const apiUrl = `/ws/rest/v1/reportingrest/reportDesign?reportDefinitionUuid=${reportDefinitionUuid}`;

  const { data, error, isValidating, mutate } = useSWR<{ data: { results: ReportDesign[] } }, Error>(
    reportDefinitionUuid ? apiUrl : null,
    openmrsFetch,
  );

  return {
    reportDesigns: data?.data.results,
    error,
    isValidating: isValidating,
    mutateReportDesigns: mutate,
  };
}

export function runReportObservable(payload: unknown): Observable<FetchResponse<unknown>> {
  const abortController = new AbortController();
  return openmrsObservableFetch(`/ws/rest/v1/reportingrest/reportRequest`, {
    signal: abortController.signal,
    method: 'POST',
    headers: {
      'Content-type': 'application/json',
    },
    body: payload,
  });
}

export async function cancelReportRequest(reportRequestUuid: string) {
  const apiUrl = `/ws/rest/v1/reportingrest/reportRequest/${reportRequestUuid}`;

  return openmrsFetch(apiUrl, {
    method: 'DELETE',
  });
}

export async function preserveReport(reportRequestUuid: string) {
  const apiUrl = `/ws/rest/v1/reportingrest/saveReport?reportRequestUuid=${reportRequestUuid}`;

  return openmrsFetch(apiUrl, {
    method: 'POST',
  });
}

export async function downloadReport(reportRequestUuid: string) {
  const apiUrl = `/ws/rest/v1/reportingrest/downloadReport?reportRequestUuid=${reportRequestUuid}`;

  const { data } = await openmrsFetch<unknown>(apiUrl);

  return data;
}

export async function downloadMultipleReports(reportRequestUuids: string[]) {
  const apiUrl = `/ws/rest/v1/reportingrest/downloadMultipleReports?reportRequestUuids=${reportRequestUuids}`;

  const { data } = await openmrsFetch<unknown>(apiUrl);

  return data;
}

function mapReportResults(data: Record<string, unknown>): ReportModel {
  const parameterizable = data.parameterizable as Record<string, unknown>;
  const requestedBy = data.requestedBy as Record<string, unknown>;
  const person = requestedBy?.person as Record<string, unknown>;
  const renderingMode = data.renderingMode as Record<string, unknown>;

  return {
    id: data.uuid as string,
    reportName: parameterizable?.name as string,
    status: data.status as string,
    requestedBy: person?.display as string,
    requestedByUserUuid: requestedBy?.uuid as string,
    requestedOn: dayjs(data.requestDate as string).format('YYYY-MM-DD HH:mm'),
    outputFormat: renderingMode?.label as string,
    parameters: convertParametersToString(data),
    evaluateCompleteDatetime: data.evaluateCompleteDatetime
      ? dayjs(data.evaluateCompleteDatetime as string).format('YYYY-MM-DD HH:mm')
      : undefined,
    schedule: data.schedule as string,
  };
}

function mapScheduledReportResults(data: Record<string, unknown>): ScheduledReportModel {
  const reportDefinition = data.reportDefinition as Record<string, unknown>;
  const scheduledRequests = data.scheduledRequests as Array<Record<string, unknown>>;

  return {
    reportDefinitionUuid: reportDefinition?.uuid as string,
    reportRequestUuid: scheduledRequests?.[0]?.uuid as string,
    name: reportDefinition?.display as string,
    schedule: scheduledRequests?.[0]?.schedule as string,
  };
}

function convertParametersToString(data: Record<string, unknown>): string {
  let finalString = '';
  const parameterizable = data.parameterizable as Record<string, unknown>;
  const parameters = parameterizable?.parameters as Array<Record<string, unknown>>;
  const parameterMappings = data.parameterMappings as Record<string, unknown>;

  if (parameters?.length > 0) {
    parameters.forEach((parameter) => {
      let value = parameterMappings?.[parameter.name as string];
      if (parameter.type === 'java.util.Date') {
        value = dayjs(value as string).format('YYYY-MM-DD');
      } else if (parameter.type === 'org.openmrs.Location') {
        value = (value as Record<string, unknown>)?.display;
      }
      finalString = finalString + (parameter.label as string) + ': ' + value + ', ';
    });

    finalString = finalString.trim();

    if (finalString.charAt(finalString.length - 1) === ',') {
      finalString = finalString.slice(0, -1);
    }
  }

  return finalString;
}

export function useReportData(reportUuid: string, parameters: Record<string, string>) {
  const [shouldFetch, setShouldFetch] = useState(false);
  const [lastReportUuid, setLastReportUuid] = useState('');

  // Reset shouldFetch when reportUuid changes
  useEffect(() => {
    if (reportUuid !== lastReportUuid) {
      setShouldFetch(false);
      setLastReportUuid(reportUuid);
    }
  }, [reportUuid, lastReportUuid]);

  // Only fetch when shouldFetch is true and we have a reportUuid
  const { data, error, isLoading, mutate } = useSWR(
    shouldFetch && reportUuid ? ['reportData', reportUuid, parameters] : null,
    async () => {
      if (!reportUuid) return null;

      // Build query string only if we have parameters
      let url = `/ws/rest/v1/reportingrest/reportdata/${reportUuid}`;
      if (Object.keys(parameters).length > 0) {
        const queryParams = new URLSearchParams();
        Object.entries(parameters).forEach(([key, value]) => {
          if (value) {
            queryParams.append(key, value);
          }
        });
        url += `?${queryParams.toString()}`;
      }

      const response = await openmrsFetch(url);
      return response.data;
    },
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      shouldRetryOnError: false,
    },
  );

  return {
    reportData: data,
    error,
    isLoading,
    mutate: () => {
      setShouldFetch(true);
      mutate();
    },
  };
}
