import { useSession } from '@openmrs/esm-framework';

/** Returns the only user UUID that may own data rendered by Offline Tools. */
export function useOfflineOwnerId(): string | undefined {
  const session = useSession();
  return session.authenticated ? session.user?.uuid : undefined;
}
