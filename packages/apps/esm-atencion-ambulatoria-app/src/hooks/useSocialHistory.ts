import { restBaseUrl, useConfig } from '@openmrs/esm-framework';
import type { ConfigObject } from '../config-schema';
import type { OpenmrsEncounter } from '../types';
import { useMergedClinicalHistoryPagination } from './useClinicalHistoryPagination';

export interface SocialHistoryEncounter {
  uuid: string;
  encounterDatetime: string;
  obs: OpenmrsEncounter['obs'];
  patient: { uuid: string };
  form: { uuid: string };
  encounterType: { uuid: string; display: string };
  voided?: boolean;
  visit: {
    uuid: string;
    startDatetime: string;
    stopDatetime?: string;
    visitType: { uuid: string; display: string };
  };
}

export const socialHistoryRepresentation =
  'custom:(uuid,voided,encounterDatetime,patient:(uuid),form:(uuid),encounterType:(uuid,display),visit:(uuid,startDatetime,stopDatetime,visitType:(uuid,display)),obs:(uuid,concept:(uuid),value:(uuid,display)))';

export function useSocialHistory(patientUuid: string) {
  const { socialHistory } = useConfig<ConfigObject>();
  const params = new URLSearchParams({
    patient: patientUuid,
    encounterType: socialHistory.encounterTypeUuid,
    v: socialHistoryRepresentation,
  });
  return useMergedClinicalHistoryPagination<SocialHistoryEncounter>(
    patientUuid && socialHistory.formUuid && socialHistory.encounterTypeUuid
      ? [
          {
            url: `${restBaseUrl}/encounter?${params}`,
            expectedFormUuid: socialHistory.formUuid,
            expectedPatientUuid: patientUuid,
            expectedEncounterTypeUuid: socialHistory.encounterTypeUuid,
          },
        ]
      : null,
  );
}
