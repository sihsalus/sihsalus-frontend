import { getSessionStore, userHasAccess } from '@openmrs/esm-framework';
import { useCallback, useSyncExternalStore } from 'react';

import { patientChartPrivilege } from './patient-chart-access';

const emptyPatientUuids: string[] = [];

/** In-memory only. Observe the session even while every search/chart component is unmounted. */
export function createRecentlyViewedPatientsStore(sessionStore = getSessionStore()) {
  let scope: string | null = null;
  let snapshot = { generation: 0, patientUuids: emptyPatientUuids };
  const listeners = new Set<() => void>();
  const notify = () => {
    listeners.forEach((listener) => {
      listener();
    });
  };

  const syncSession = () => {
    const { loaded, session } = sessionStore.getState();
    const user = session?.user;
    const nextScope =
      loaded &&
      session?.authenticated &&
      user?.uuid &&
      Array.isArray(user.privileges) &&
      Array.isArray(user.roles) &&
      userHasAccess(patientChartPrivilege, user)
        ? JSON.stringify([
            // REST 3.5.0 does not return a sessionId. Use it when a backend does,
            // but never require or invent one: observed session changes own the epoch.
            session.sessionId || null,
            user.uuid,
            session.sessionLocation?.uuid,
            user.privileges.map(({ name }) => name).sort(),
            user.roles.map(({ name }) => name).sort(),
          ])
        : null;

    if (nextScope !== scope) {
      scope = nextScope;
      snapshot = {
        generation: snapshot.generation + 1,
        patientUuids: emptyPatientUuids,
      };
      notify();
    }
  };

  syncSession();
  const unsubscribeSession = sessionStore.subscribe(syncSession);

  return {
    getSnapshot: () => snapshot,
    isCurrentGeneration: (generation: number) => Boolean(scope) && generation === snapshot.generation,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    record: (patientUuid: string, generation: number) => {
      syncSession();
      // Ignore a callback belonging to a previous account/session or an unloaded chart.
      if (!scope || generation !== snapshot.generation || !patientUuid || snapshot.patientUuids[0] === patientUuid) {
        return;
      }
      snapshot = {
        ...snapshot,
        patientUuids: [patientUuid, ...snapshot.patientUuids.filter((uuid) => uuid !== patientUuid)].slice(0, 10),
      };
      notify();
    },
    dispose: unsubscribeSession,
  };
}

let recentPatientsStore: ReturnType<typeof createRecentlyViewedPatientsStore>;

function getRecentPatientsStore() {
  recentPatientsStore ??= createRecentlyViewedPatientsStore();
  return recentPatientsStore;
}

export function isRecentPatientRequestCurrent(generation: number) {
  return getRecentPatientsStore().isCurrentGeneration(generation);
}

export function useRecentlyViewedPatients(enabled = false) {
  const store = getRecentPatientsStore();
  const { generation, patientUuids } = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const recordViewedPatient = useCallback(
    (patientUuid: string) => {
      if (enabled) {
        store.record(patientUuid, generation);
      }
    },
    [enabled, generation, store],
  );

  return {
    recentlyViewedPatientUuids: enabled ? patientUuids : emptyPatientUuids,
    cacheGeneration: generation,
    recordViewedPatient,
  };
}
