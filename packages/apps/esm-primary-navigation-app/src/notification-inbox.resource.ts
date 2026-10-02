import { openmrsFetch, restBaseUrl, useConfig, useSession, type NotificationInboxItem } from '@openmrs/esm-framework';
import { useEffect, useRef } from 'react';
import useSWR from 'swr';
import { type ConfigSchema } from './config-schema';

export type NotificationInbox = {
  items: NotificationInboxItem[];
  total: number;
  hasMore: boolean;
};
export function useNotificationInbox(offset = 0) {
  const session = useSession();
  const { enableNotificationInbox } = useConfig<ConfigSchema>();
  const allowed = enableNotificationInbox && session?.authenticated && session.sessionLocation?.uuid;
  const sessionKey = allowed ? `${session?.sessionId}:${session?.user?.uuid}:${session?.sessionLocation?.uuid}` : null;
  // Include user and location in the cache identity, never local/session storage.
  const url = `${restBaseUrl.replace(/\/rest\/v1\/?$/, '')}/sihsalus/notifications/inbox`;
  const key = allowed ? [url, sessionKey, offset] : null;
  const inbox = useSWR<NotificationInbox>(
    key,
    () =>
      openmrsFetch<NotificationInbox>(`${url}?offset=${offset}`, {
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
    const source = new EventSource(`${url.replace(/\/inbox$/, '')}/sse?topics=notifications`, {
      withCredentials: true,
    });
    // Coalesce signals and serialize refreshes; the persisted inbox is authoritative.
    let timer: ReturnType<typeof setTimeout> | undefined;
    let inFlight = false;
    let dirty = false;
    let disposed = false;
    const schedule = () => {
      if (!disposed && dirty && !timer && !inFlight) timer = setTimeout(flush, 1000);
    };
    const flush = async () => {
      timer = undefined;
      dirty = false;
      inFlight = true;
      try {
        await refresh.current();
      } catch {
        // SWR exposes the error; retain cached items rather than claiming an empty inbox.
      } finally {
        inFlight = false;
        schedule();
      }
    };
    const update = () => {
      dirty = true;
      schedule();
    };
    source.addEventListener('NOTIFICATION_CREATED', update);
    source.addEventListener('SIHSALUS_RESYNC_REQUIRED', update);
    return () => {
      disposed = true;
      source.close();
      if (timer) clearTimeout(timer);
    };
  }, [sessionKey, url]);
  return {
    ...inbox,
    sessionKey,
    allowed: Boolean(allowed),
    markRead: async (id: number) => {
      await openmrsFetch(`${url}/${id}/read`, {
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
                items: current.items.filter((item) => item.id !== id),
                total: Math.max(0, current.total - 1),
              }
            : current,
        { revalidate: false },
      );
      // A refresh failure is exposed by SWR; it does not undo a confirmed acknowledgement.
      void inbox.mutate().catch(() => undefined);
    },
  };
}
