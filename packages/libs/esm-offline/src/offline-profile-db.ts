import Dexie, { type Table } from 'dexie';

export const clinicalOfflineCacheName = 'omrs-clinical-cache-v1';
export const legacyOfflineCacheName = 'omrs-spa-cache-v1';
export const offlineStorageLockName = 'openmrs-offline-storage';
export const offlineSynchronizationLockName = 'openmrs-offline-synchronization';
export const offlineProfileErrorMessage = 'The offline profile is unavailable.';

export interface OfflineProfile {
  id: 'profile';
  ownerId: string;
  activeUserId?: string;
  generation: number;
  phase: 'active' | 'needs-cleanup' | 'clearing';
  sessionUrl: string;
}

/**
 * Separate metadata preserves the existing EsmOffline v4 queue and rollback format.
 * The profile owns downloaded responses; queued actions retain their existing user ownership.
 */
export class OfflineProfileDb extends Dexie {
  profile: Table<OfflineProfile, string>;

  constructor() {
    super('EsmOfflineProfile');
    this.version(1).stores({ profile: 'id' });
    this.profile = this.table('profile');
  }
}

export async function readOfflineProfile(): Promise<OfflineProfile | undefined> {
  const db = new OfflineProfileDb();
  try {
    const profile = await db.profile.get('profile');
    if (
      profile &&
      (profile.id !== 'profile' ||
        typeof profile.ownerId !== 'string' ||
        !profile.ownerId.trim() ||
        (profile.activeUserId !== undefined &&
          (typeof profile.activeUserId !== 'string' || !profile.activeUserId.trim())) ||
        !Number.isSafeInteger(profile.generation) ||
        profile.generation < 0 ||
        !['active', 'needs-cleanup', 'clearing'].includes(profile.phase) ||
        typeof profile.sessionUrl !== 'string')
    )
      throw new Error(offlineProfileErrorMessage);
    return profile;
  } finally {
    db.close();
  }
}

export function canUseOfflineProfile(profile: OfflineProfile | undefined, userId?: string): profile is OfflineProfile {
  return (
    !!profile && !!userId && profile.phase === 'active' && profile.ownerId === userId && profile.activeUserId === userId
  );
}

export async function withOfflineStorageLock<T>(
  mode: 'shared' | 'exclusive',
  operation: () => Promise<T>,
  ifAvailable = false,
): Promise<T> {
  const locks = globalThis.navigator?.locks;
  if (!locks?.request) {
    // Existing queue-first online consumers also work without the offline capability.
    // Purging is never allowed without an exclusive browser lock.
    if (mode === 'shared' && !(await readOfflineProfile())) return operation();
    throw new Error(offlineProfileErrorMessage);
  }
  return locks.request(offlineStorageLockName, { mode, ifAvailable }, async (lock) => {
    if (!lock) throw new Error(offlineProfileErrorMessage);
    return operation();
  });
}

export function matchesOfflineProfile(
  current: OfflineProfile | undefined,
  expected: OfflineProfile | undefined,
): boolean {
  return !!expected && canUseOfflineProfile(current, expected.ownerId) && current.generation === expected.generation;
}
