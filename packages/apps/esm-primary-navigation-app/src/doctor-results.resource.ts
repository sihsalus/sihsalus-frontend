import { openmrsFetch, restBaseUrl, useConfig, useSession } from '@openmrs/esm-framework';
import { useEffect, useRef } from 'react';
import useSWR from 'swr';
import { type ConfigSchema } from './config-schema';

export type PendingResult = {
  id: number;
  orderUuid: string;
  patientUuid: string;
  patientName: string;
  testName: string;
  createdAt: string;
};
export type ResultInbox = {
  results: PendingResult[];
  total: number;
  hasMore: boolean;
};
const readPrivileges = ['app:hoja.clinica.ordenes', 'Get Orders', 'Get Patients', 'Get Observations'];
export function useDoctorResults(offset = 0) {
  const session = useSession();
  const { enableDoctorResultNotifications } = useConfig<ConfigSchema>();
  const allowed =
    enableDoctorResultNotifications &&
    session?.authenticated &&
    readPrivileges.every((privilege) => session.user?.privileges?.some((item) => item.name === privilege)) &&
    session.sessionLocation?.uuid;
  const sessionKey = allowed ? `${session?.sessionId}:${session?.user?.uuid}:${session?.sessionLocation?.uuid}` : null;
  // Include user and location in the cache identity, never local/session storage.
  const url = `${restBaseUrl.replace(/\/rest\/v1\/?$/, '')}/sihsalus/notifications/results`;
  const key = allowed ? [url, sessionKey, offset] : null;
  const inbox = useSWR<ResultInbox>(
    key,
    () =>
      openmrsFetch<ResultInbox>(`${url}?offset=${offset}`, {
        cache: 'no-store',
      }).then((r) => r.data),
    {
      refreshInterval: 60000,
      revalidateOnFocus: true,
      keepPreviousData: false,
      shouldRetryOnError: false,
    },
  );
  const refresh = useRef(inbox.mutate);
  refresh.current = inbox.mutate;
  useEffect(() => {
    if (!sessionKey || typeof EventSource === 'undefined') return;
    const source = new EventSource(`${url.replace(/\/results$/, '')}/sse?topics=clinical-results`, {
      withCredentials: true,
    });
    // Collapse a burst into one refresh. The durable inbox remains authoritative.
    let timer: ReturnType<typeof setTimeout> | undefined;
    const update = () => {
      if (!timer)
        timer = setTimeout(() => {
          timer = undefined;
          void refresh.current().catch(() => undefined);
        }, 1000);
    };
    source.addEventListener('LAB_RESULT_READY', update);
    source.addEventListener('SIHSALUS_RESYNC_REQUIRED', update);
    return () => {
      source.close();
      if (timer) clearTimeout(timer);
    };
  }, [sessionKey, url]);
  return {
    ...inbox,
    sessionKey,
    allowed: Boolean(allowed),
    review: async (id: number) => {
      await openmrsFetch(`${url}/${id}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: {},
        cache: 'no-store',
      });
      await inbox.mutate(
        (current) =>
          current
            ? {
                ...current,
                results: current.results.filter((item) => item.id !== id),
                total: Math.max(0, current.total - 1),
              }
            : current,
        { revalidate: false },
      );
      // A refresh failure is exposed by SWR; it does not undo a confirmed review.
      void inbox.mutate().catch(() => undefined);
    },
  };
}
