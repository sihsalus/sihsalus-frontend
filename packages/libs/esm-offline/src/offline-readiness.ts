import { getDynamicOfflineDataEntriesFor, getDynamicOfflineDataHandlers } from './dynamic-offline-data';
import { captureOfflineProfile, getOfflineProfileStatus } from './offline-profile';
import { matchesOfflineProfile } from './offline-profile-db';

export interface OfflineReadiness {
  ready: boolean;
  profile: 'ready' | 'needs-cleanup' | 'unavailable';
  storage: 'available' | 'low' | 'unknown';
  persistent: boolean;
  patients: number;
  forms: number;
  incomplete: number;
  oldestDownload?: Date;
}

/** Checks selected downloads, not clinical completeness or permission to use an offline workflow. */
export async function getOfflineReadiness(): Promise<OfflineReadiness> {
  const result: OfflineReadiness = {
    ready: false,
    profile: 'unavailable',
    storage: 'unknown',
    persistent: false,
    patients: 0,
    forms: 0,
    incomplete: 0,
  };
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  // Some third-party handlers ignore the abort signal. Bound the caller's wait as well.
  const timeout = new Promise<OfflineReadiness>((resolve) => {
    timer = setTimeout(() => {
      controller.abort();
      resolve({ ...result, ready: false });
    }, 10000);
  });
  const check = async () => {
    if (!globalThis.isSecureContext || !navigator.serviceWorker?.controller || !navigator.locks?.request) return result;
    result.profile = await getOfflineProfileStatus();
    if (result.profile !== 'ready') return result;
    const profile = await captureOfflineProfile();
    const [estimate, persisted] = await Promise.allSettled([
      navigator.storage?.estimate?.(),
      navigator.storage?.persisted?.(),
    ]);
    if (persisted.status === 'fulfilled') result.persistent = persisted.value === true;
    if (estimate.status === 'fulfilled') {
      const { quota, usage } = estimate.value ?? {};
      if (
        typeof quota === 'number' &&
        Number.isFinite(quota) &&
        quota > 0 &&
        typeof usage === 'number' &&
        Number.isFinite(usage) &&
        usage >= 0 &&
        usage <= quota
      ) {
        // An operational reserve, not a guarantee that a particular form/photo will fit.
        result.storage = quota - usage >= 10 * 1024 * 1024 ? 'available' : 'low';
      }
    }
    const entries = await getDynamicOfflineDataEntriesFor(profile.ownerId);
    const handlers = getDynamicOfflineDataHandlers();
    for (const entry of entries) {
      if (controller.signal.aborted) return { ...result, ready: false };
      if (entry.type !== 'patient' && entry.type !== 'form') continue;
      const applicable = handlers.filter((handler) => handler.type === entry.type);
      const state = entry.syncState;
      const time = state?.syncedOn instanceof Date ? state.syncedOn.getTime() : NaN;
      let valid =
        !!state &&
        Number.isFinite(time) &&
        time <= Date.now() &&
        state.syncedBy === profile.ownerId &&
        state.erroredHandlers.length === 0 &&
        applicable.length > 0 &&
        applicable.every((handler) => state.succeededHandlers.includes(handler.id));
      if (valid) {
        const checks = await Promise.allSettled(
          applicable.map((handler) =>
            Promise.resolve().then(() => handler.isSynced(entry.identifier, controller.signal)),
          ),
        );
        valid = checks.every((check) => check.status === 'fulfilled' && check.value === true);
      }
      if (valid) {
        result[entry.type === 'patient' ? 'patients' : 'forms']++;
        if (!result.oldestDownload || time < result.oldestDownload.getTime()) result.oldestDownload = new Date(time);
      } else result.incomplete++;
    }
    if (!matchesOfflineProfile(await captureOfflineProfile(), profile)) throw new Error('Offline profile changed.');
    result.ready =
      !controller.signal.aborted &&
      result.storage === 'available' &&
      result.patients > 0 &&
      result.forms > 0 &&
      result.incomplete === 0;
    return result;
  };
  try {
    return await Promise.race([
      check().catch(() => ({ ...result, ready: false, profile: 'unavailable' as const })),
      timeout,
    ]);
  } finally {
    clearTimeout(timer);
  }
}
