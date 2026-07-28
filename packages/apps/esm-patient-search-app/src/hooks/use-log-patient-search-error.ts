import { logError } from '@openmrs/esm-framework';
import { useEffect } from 'react';

export function useLogPatientSearchError(error: Error | null, context: string) {
  useEffect(() => {
    if (error) {
      logError(error, context);
    }
  }, [context, error]);
}
