import { useConfig, useEmrConfiguration, useSession, useVisit } from '@openmrs/esm-framework';
import { useState } from 'react';

import type { OdontogramConfig } from '../config-schema';
import {
  applyExistingObsUuids,
  mapToAmpathOdontogramEncounterPayload,
} from '../odontogram/ampath-form-odontogram-mapper';
import type { OdontogramData } from '../odontogram/types/odontogram';
import { fetchEncounterObs, saveEncounter, updateEncounter } from '../odontogram.resource';
import type { OdontogramRecordType } from '../types/odontogram-record';

interface SaveOdontogramParams {
  patientUuid: string;
  /** Present when editing an existing record; omit to create a new one. */
  encounterUuid?: string;
  data: OdontogramData;
  recordType: OdontogramRecordType;
  /** Parent base encounter for evolutive (attention) records. */
  baseEncounterUuid?: string | null;
}

export const odontogramContextErrorCode = 'ODONTOGRAM_CREATE_CONTEXT_UNAVAILABLE';

export function useOdontogramEncounter(hookPatientUuid: string) {
  const config = useConfig<OdontogramConfig>();
  const session = useSession();
  const { activeVisit, isLoading: isLoadingVisit, error: visitError } = useVisit(hookPatientUuid);
  const { emrConfiguration, isLoadingEmrConfiguration, errorFetchingEmrConfiguration } = useEmrConfiguration();
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const save = async ({ patientUuid, encounterUuid, data, recordType, baseEncounterUuid }: SaveOdontogramParams) => {
    setIsSaving(true);
    setError(null);

    try {
      if (!patientUuid || patientUuid !== hookPatientUuid) {
        throw Object.assign(new Error('Odontogram patient context does not match'), {
          code: odontogramContextErrorCode,
        });
      }
      const encounterTypeUuid =
        recordType === 'base' ? config.baseEncounterTypeUuid?.trim() : config.attentionEncounterTypeUuid?.trim();

      if (!encounterTypeUuid) {
        throw new Error(
          recordType === 'base'
            ? 'Missing required config: baseEncounterTypeUuid'
            : 'Missing required config: attentionEncounterTypeUuid',
        );
      }

      const payload = mapToAmpathOdontogramEncounterPayload({
        activeBaseEncounterUuid: baseEncounterUuid ?? null,
        config,
        data,
        encounterTypeUuid,
        patientUuid,
        recordType,
      });

      let response: { data: unknown };
      if (encounterUuid) {
        // Reuse the existing obs uuids so the update edits values in place
        // instead of appending duplicate obs for the same concepts.
        const existingObs = await fetchEncounterObs(encounterUuid, patientUuid);
        response = await updateEncounter(encounterUuid, { obs: applyExistingObsUuids(payload, existingObs).obs });
      } else {
        const providerUuid = session?.currentProvider?.uuid;
        const locationUuid = session?.sessionLocation?.uuid;
        const encounterRoleUuid = emrConfiguration?.clinicianEncounterRole?.uuid;
        if (
          isLoadingVisit ||
          visitError ||
          !activeVisit?.uuid ||
          activeVisit.stopDatetime ||
          activeVisit.patient?.uuid !== patientUuid ||
          !providerUuid ||
          !locationUuid ||
          !encounterRoleUuid ||
          isLoadingEmrConfiguration ||
          errorFetchingEmrConfiguration
        ) {
          throw Object.assign(new Error('Odontogram creation context is unavailable'), {
            code: odontogramContextErrorCode,
          });
        }
        response = await saveEncounter({
          ...payload,
          visit: activeVisit.uuid,
          location: locationUuid,
          encounterProviders: [{ provider: providerUuid, encounterRole: encounterRoleUuid }],
        });
      }

      return response.data;
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      throw err;
    } finally {
      setIsSaving(false);
    }
  };

  return { save, isSaving, error };
}
