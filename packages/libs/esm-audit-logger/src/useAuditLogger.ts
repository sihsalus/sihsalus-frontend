import { useSession } from '@openmrs/esm-framework';
import { useCallback, useEffect } from 'react';

import { auditLogger } from './AuditLogger';
import type { AuditEvent } from './types';

export function useAuditLogger(): (event: Omit<AuditEvent, 'timestamp' | 'userUuid' | 'sessionId'>) => Promise<void> {
  const session = useSession();

  // Sync session; clear when unauthenticated to prevent cross-user attribution.
  useEffect(() => {
    if (session?.authenticated && session.user?.uuid && session.sessionId) {
      auditLogger.setSession(session.user.uuid, session.sessionId, session.sessionLocation?.uuid);
    } else {
      auditLogger.clearSession();
    }
  }, [session?.authenticated, session?.sessionId, session?.sessionLocation?.uuid, session?.user?.uuid]);

  // Consumers share one global logger across independently bundled MFEs. The
  // reference count prevents one MFE unmount from disabling another's logger.
  useEffect(() => {
    auditLogger.acquire();
    return () => auditLogger.release();
  }, []);

  // Stable reference across renders — consumers can use it as a dep safely.
  return useCallback((event: Omit<AuditEvent, 'timestamp' | 'userUuid' | 'sessionId'>) => auditLogger.log(event), []);
}
