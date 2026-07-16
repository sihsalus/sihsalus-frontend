import { getUserFacingErrorMessage, logError } from '@openmrs/esm-framework';
import { useEffect, useRef } from 'react';

export function useUserFacingErrorMessage(error: unknown, fallback: string, logContext: string): string {
  const lastLoggedError = useRef<unknown>(undefined);

  useEffect(() => {
    if (error && error !== lastLoggedError.current) {
      logError(error, logContext);
      lastLoggedError.current = error;
    }
  }, [error, logContext]);

  return error ? getUserFacingErrorMessage(error, fallback, { log: false }) : '';
}
