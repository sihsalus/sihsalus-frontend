/** @module @category API */

import { type FetchResponse, openmrsFetch } from '@openmrs/esm-api';
import { type AttachmentResponse, attachmentUrl } from '@openmrs/esm-emr-api';
import { useMemo } from 'react';
import useSWR from 'swr';

type AttachmentFetchResponse = FetchResponse<{ results: Array<AttachmentResponse> }>;
type AttachmentRequestKey = string | readonly ['patient-attachments', string, string];

function isAsciiDigit(character: string | undefined): boolean {
  return character !== undefined && character >= '0' && character <= '9';
}

function isAsciiWordCharacter(character: string | undefined): boolean {
  return (
    isAsciiDigit(character) ||
    (character !== undefined && character >= 'A' && character <= 'Z') ||
    (character !== undefined && character >= 'a' && character <= 'z') ||
    character === '_'
  );
}

function getStatusFromMessage(message: string): number | undefined {
  for (const prefix of message.matchAll(/\b(?:HTTP(?: status(?: code)?)?|status(?: code)?|responded with)/gi)) {
    let cursor = (prefix.index ?? 0) + prefix[0].length;

    while (message[cursor]?.trim() === '') {
      cursor += 1;
    }

    if (message[cursor] === ':') {
      cursor += 1;
      while (message[cursor]?.trim() === '') {
        cursor += 1;
      }
    }

    const status = message.slice(cursor, cursor + 3);
    if (
      status.length === 3 &&
      status[0] >= '1' &&
      status[0] <= '5' &&
      isAsciiDigit(status[1]) &&
      isAsciiDigit(status[2]) &&
      !isAsciiWordCharacter(message[cursor + 3])
    ) {
      return Number(status);
    }
  }

  return undefined;
}

function fetchAttachments(key: AttachmentRequestKey) {
  if (typeof key === 'string') {
    return openmrsFetch<{ results: Array<AttachmentResponse> }>(key);
  }

  return openmrsFetch<{ results: Array<AttachmentResponse> }>(key[1], { rejectOnAuthFailure: true });
}

export function getAttachmentErrorStatus(error: unknown): number | undefined {
  const errorRecord = typeof error === 'object' && error ? (error as Record<string, unknown>) : undefined;
  const response =
    typeof errorRecord?.response === 'object' && errorRecord.response
      ? (errorRecord.response as Record<string, unknown>)
      : undefined;
  const responseBody =
    typeof errorRecord?.responseBody === 'object' && errorRecord.responseBody
      ? (errorRecord.responseBody as Record<string, unknown>)
      : undefined;
  const responseBodyError =
    typeof responseBody?.error === 'object' && responseBody.error
      ? (responseBody.error as Record<string, unknown>)
      : undefined;
  const candidates = [
    response?.status,
    errorRecord?.status,
    errorRecord?.statusCode,
    responseBody?.status,
    responseBodyError?.status,
  ];

  for (const candidate of candidates) {
    const status = typeof candidate === 'string' && candidate.trim() ? Number(candidate) : candidate;

    if (typeof status === 'number' && Number.isInteger(status) && status >= 100 && status <= 599) {
      return status;
    }
  }

  const message = typeof error === 'string' ? error : errorRecord?.message;
  if (typeof message === 'string') {
    return getStatusFromMessage(message);
  }

  return undefined;
}

function shouldRetryAttachmentFetch(error: unknown): boolean {
  const status = getAttachmentErrorStatus(error);

  if (status === undefined) {
    return true;
  }

  return status !== 401 && status !== 403;
}

/**
 * A React hook that fetches attachments for a patient using SWR for caching
 * and automatic revalidation.
 *
 * @param patientUuid The UUID of the patient whose attachments should be fetched.
 * @param includeEncounterless Whether to include attachments that are not
 *   associated with any encounter.
 * @param enabled Whether the request should be made. Defaults to `true`.
 * @param cacheScope Optional authenticated-session identifier used to isolate cached results. When supplied,
 *   authorization failures are exposed without retry and any previously cached attachments are hidden.
 * @returns An object containing:
 *   - `data`: Array of attachment objects (empty array while loading)
 *   - `isLoading`: Whether the initial fetch is in progress
 *   - `isValidating`: Whether any request (initial or revalidation) is in progress
 *   - `error`: Any error that occurred during fetching
 *   - `mutate`: Function to trigger a revalidation of the data
 *
 * @example
 * ```tsx
 * import { useAttachments } from '@openmrs/esm-framework';
 * function PatientAttachments({ patientUuid }) {
 *   const { data, isLoading, error } = useAttachments(patientUuid, true);
 *   if (isLoading) return <span>Loading...</span>;
 *   if (error) return <span>Error loading attachments</span>;
 *   return <AttachmentList attachments={data} />;
 * }
 * ```
 */
export function useAttachments(
  patientUuid: string,
  includeEncounterless: boolean,
  enabled = true,
  cacheScope?: string,
) {
  const shouldFetch = enabled && Boolean(patientUuid);
  const url = `${attachmentUrl}?patient=${patientUuid}&includeEncounterless=${includeEncounterless}`;
  const requestKey = shouldFetch ? (cacheScope ? (['patient-attachments', url, cacheScope] as const) : url) : null;
  const { data, error, mutate, isLoading, isValidating } = useSWR<AttachmentFetchResponse>(
    requestKey,
    fetchAttachments,
    cacheScope ? { shouldRetryOnError: shouldRetryAttachmentFetch } : undefined,
  );
  const errorStatus = getAttachmentErrorStatus(error);
  const hasAuthorizationError = Boolean(cacheScope && (errorStatus === 401 || errorStatus === 403));

  const results = useMemo(
    () => ({
      isLoading: shouldFetch ? isLoading : false,
      data: shouldFetch && !hasAuthorizationError ? (data?.data.results ?? []) : [],
      error: shouldFetch ? error : undefined,
      mutate,
      isValidating: shouldFetch ? isValidating : false,
    }),
    [data, error, hasAuthorizationError, isLoading, isValidating, mutate, shouldFetch],
  );

  return results;
}
