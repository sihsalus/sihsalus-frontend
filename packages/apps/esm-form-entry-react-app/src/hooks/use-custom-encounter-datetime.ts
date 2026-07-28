import { type PreFilledQuestions } from '@sihsalus/esm-form-engine-lib';
import dayjs from 'dayjs';
import { useMemo } from 'react';

import type { FormEntryReactConfig } from '../types';

/**
 * When customEncounterDatetime is enabled and the visit started before today,
 * defaults the encounter date to visitStartDatetime instead of the current time.
 *
 * This is merged into preFilledQuestions before being passed to FormEngine.
 */
export function useCustomEncounterDatetime(
  config: FormEntryReactConfig,
  visitStartDatetime?: string,
  existingPreFilledQuestions?: PreFilledQuestions,
): PreFilledQuestions | undefined {
  return useMemo(() => {
    if (!config.customEncounterDatetime || !visitStartDatetime) {
      return existingPreFilledQuestions;
    }

    const visitStart = dayjs(visitStartDatetime);
    if (visitStart.isBefore(dayjs(), 'day')) {
      return {
        ...existingPreFilledQuestions,
        encDate: visitStart.toISOString(),
      };
    }

    return existingPreFilledQuestions;
  }, [config.customEncounterDatetime, visitStartDatetime, existingPreFilledQuestions]);
}
