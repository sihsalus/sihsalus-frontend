import {
  type FetchResponse,
  getUserFacingErrorMessage as frameworkGetUserFacingErrorMessage,
  openmrsFetch,
  restBaseUrl,
  showSnackbar,
} from '@openmrs/esm-framework';
import { getCompatibleUserFacingErrorMessage } from '@openmrs/esm-utils';
import { useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import useSWR from 'swr';
import { useSWRConfig } from 'swr/_internal';

import { type QueueEntry, type QueueEntrySearchCriteria } from '../types';

type QueueEntryResponse = FetchResponse<{
  results: Array<QueueEntry>;
  links: Array<{
    rel: 'prev' | 'next';
    uri: string;
  }>;
  totalCount: number;
}>;

const queueEntryBaseUrl = `${restBaseUrl}/queue-entry`;

export const queueEntryRepresentation =
  'custom:(uuid,display,queue:(uuid,display,name,location:(uuid,display),service:(uuid,display)),status,patient:(uuid,display,person,identifiers:(uuid,display,identifier,identifierType)),visit:(uuid,display,startDatetime,location:(uuid,display),encounters:(uuid,display,diagnoses,encounterDatetime,encounterType,obs,encounterProviders,voided),attributes:(uuid,display,value,attributeType:(uuid,display))),priority,priorityComment,sortWeight,startedAt,endedAt,locationWaitingFor,queueComingFrom,providerWaitingFor,previousQueueEntry)';

function getInitialUrl(rep: string, searchCriteria?: QueueEntrySearchCriteria) {
  const searchParam = new URLSearchParams();
  searchParam.append('v', rep);
  searchParam.append('totalCount', 'true');

  if (searchCriteria) {
    for (const [key, value] of Object.entries(searchCriteria)) {
      if (value != null) {
        searchParam.append(key, value?.toString());
      }
    }
  }

  return `${queueEntryBaseUrl}?${searchParam.toString()}`;
}

function getNextUrlFromResponse(data: QueueEntryResponse) {
  const next = data?.data?.links?.find((link) => link.rel === 'next');
  if (next) {
    const nextUrl = new URL(next.uri);
    // default for production
    if (nextUrl.origin === globalThis.location.origin) {
      return nextUrl.toString();
    }

    // in development, the request should be routed through the local proxy
    return new URL(`${nextUrl.pathname}${nextUrl.search ? nextUrl.search : ''}`, globalThis.location.origin).toString();
  }
  // There's no next URL
  return null;
}

export function useMutateQueueEntries() {
  const { t } = useTranslation();
  const { mutate } = useSWRConfig();
  const mutateQueueEntries = useCallback(async () => {
    try {
      await mutate((key) => {
        return (
          typeof key === 'string' &&
          (key.includes(`${restBaseUrl}/queue-entry`) || key.includes(`${restBaseUrl}/visit-queue-entry`))
        );
      });
      globalThis.dispatchEvent(new CustomEvent('queue-entry-updated', { detail: { queueEntriesRevalidated: true } }));
    } catch (error) {
      showSnackbar({
        title: t('errorLoadingQueueEntries', 'Error loading queue entries'),
        kind: 'error',
        isLowContrast: false,
        subtitle: getCompatibleUserFacingErrorMessage(
          error,
          t('queueDataLoadErrorMessage', 'Queue information could not be loaded. Please try again.'),
          { logContext: 'Refresh queue entries' },
          frameworkGetUserFacingErrorMessage,
        ),
      });
    }
  }, [mutate, t]);

  return {
    mutateQueueEntries,
  };
}

async function fetchAllQueueEntries(initialUrl: string) {
  const results: Array<QueueEntry> = [];
  const visitedPages = new Set<string>();
  let url: string | null = initialUrl;
  let totalCount: number | undefined;

  while (url) {
    if (visitedPages.has(url)) {
      throw new Error('Queue information could not be loaded.');
    }
    visitedPages.add(url);

    // A queue refresh must reach the server, even when the worker has an older download.
    const page = await openmrsFetch<QueueEntryResponse['data']>(url, { cache: 'no-store' });
    if (!Array.isArray(page?.data?.results)) {
      throw new Error('Queue information could not be loaded.');
    }
    totalCount ??= page.data.totalCount;
    results.push(...page.data.results);
    url = getNextUrlFromResponse(page);
  }

  // Publish only after every page succeeds. SWR retains the previous complete
  // result on failure and keeps this query subscribed for retry/reconnection.
  return { results, totalCount: totalCount ?? results.length };
}

export function useQueueEntries(searchCriteria?: QueueEntrySearchCriteria, rep: string = queueEntryRepresentation) {
  const { mutateQueueEntries } = useMutateQueueEntries();
  const { data, error, isLoading, isValidating, mutate } = useSWR<
    Awaited<ReturnType<typeof fetchAllQueueEntries>>,
    Error
  >(getInitialUrl(rep, searchCriteria), fetchAllQueueEntries, {
    refreshInterval: 15_000,
    refreshWhenHidden: false,
    refreshWhenOffline: false,
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
  });

  useEffect(() => {
    const queueUpdateListener = (event: Event) => {
      if ((event as CustomEvent<{ queueEntriesRevalidated?: boolean }>).detail?.queueEntriesRevalidated) return;
      // The hook's error state reports a failed refresh to its consumers.
      void mutate().catch(() => undefined);
    };
    globalThis.addEventListener('queue-entry-updated', queueUpdateListener);
    return () => globalThis.removeEventListener('queue-entry-updated', queueUpdateListener);
  }, [mutate]);

  const queueEntries = useMemo(() => data?.results ?? [], [data]);

  return {
    queueEntries,
    totalCount: data?.totalCount ?? 0,
    isLoading,
    isValidating,
    error,
    mutate: mutateQueueEntries,
  };
}

export function useQueueEntriesMetrics(searchCriteria?: QueueEntrySearchCriteria) {
  const searchParam = new URLSearchParams();
  for (const [key, value] of Object.entries(searchCriteria)) {
    if (value != null) {
      searchParam.append(key, value?.toString());
    }
  }
  const apiUrl = `${restBaseUrl}/queue-entry-metrics?` + searchParam.toString();

  const { data, error, isLoading } = useSWR<
    {
      data: {
        count: number;
        averageWaitTime: number;
      };
    },
    Error
  >(apiUrl, openmrsFetch);

  return {
    count: data ? data?.data?.count : 0,
    averageWaitTime: data?.data?.averageWaitTime,
    error,
    isLoading,
  };
}
