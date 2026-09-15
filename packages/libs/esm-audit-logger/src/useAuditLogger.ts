import { useSession } from '@openmrs/esm-framework';
import { useCallback, useEffect } from 'react';

import { auditLogger } from './AuditLogger';
import type { AuditEvent } from './types';

export function useAuditLogger(): (event: Omit<AuditEvent, 'timestamp' | 'userUuid'>) => Promise<void> {
  const session = useSession();

  // Start/stop the online-flush listener with the component lifecycle.
  useEffect(() => {
    auditLogger.init();
    return () => {
      auditLogger.clearSession();
      auditLogger.destroy();
    };
  }, []);

  // Sync session; clear when unauthenticated to prevent cross-user attribution.
  useEffect(() => {
    if (session?.authenticated && session.user?.uuid) {
      auditLogger.setSession(session.user.uuid);
    } else {
      auditLogger.clearSession();
    }
  }, [session?.authenticated, session?.user?.uuid]);

  // Stable reference across renders — consumers can use it as a dep safely.
  return useCallback((event: Omit<AuditEvent, 'timestamp' | 'userUuid'>) => auditLogger.log(event), []);
}
