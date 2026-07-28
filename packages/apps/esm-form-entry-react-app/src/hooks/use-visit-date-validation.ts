import { openmrsFetch, restBaseUrl, showSnackbar } from '@openmrs/esm-framework';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { updateVisitDates } from '../api/visit.resource';
import type { Encounter } from '../types';

type EncounterDatetimeResponse = Pick<Encounter, 'encounterDatetime'>;

/**
 * Post-submission hook that validates encounter datetime against visit bounds
 * and auto-adjusts visit dates if needed.
 *
 * Called after FormEngine successfully submits the encounter.
 */
export function useVisitDateValidation(visitUuid: string, visitStartDatetime: string, visitStopDatetime?: string) {
  const { t } = useTranslation();

  const adjustVisitDatesIfNeeded = useCallback(
    async (encounterUuid: string) => {
      if (!visitUuid || !encounterUuid) return;

      try {
        // Fetch the saved encounter to get its datetime
        const encounterResponse = await openmrsFetch<EncounterDatetimeResponse>(
          `${restBaseUrl}/encounter/${encounterUuid}?v=custom:(uuid,encounterDatetime)`,
        );
        const encounterDatetime = encounterResponse.data.encounterDatetime;
        if (!encounterDatetime) return;

        const encDate = new Date(encounterDatetime).getTime();
        const visitStart = new Date(visitStartDatetime).getTime();
        const visitStop = visitStopDatetime ? new Date(visitStopDatetime).getTime() : null;

        let adjusted = false;

        if (encDate < visitStart) {
          await updateVisitDates(visitUuid, encounterDatetime, undefined);
          adjusted = true;
        }

        if (visitStop && encDate > visitStop) {
          await updateVisitDates(visitUuid, undefined, encounterDatetime);
          adjusted = true;
        }

        if (adjusted) {
          showSnackbar({
            title: t('visitDateAdjusted', 'Visit date adjusted'),
            subtitle: t(
              'visitDateAdjustedDescription',
              'The visit dates were automatically adjusted to include the encounter date.',
            ),
            kind: 'info',
            isLowContrast: true,
          });
        }
      } catch (error) {
        console.error('Failed to validate/adjust visit dates:', error);
      }
    },
    [visitUuid, visitStartDatetime, visitStopDatetime, t],
  );

  return { adjustVisitDatesIfNeeded };
}
