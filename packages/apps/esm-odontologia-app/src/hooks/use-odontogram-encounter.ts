import { useConfig } from '@openmrs/esm-framework';
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

export function useOdontogramEncounter() {
  const config = useConfig<OdontogramConfig>();
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const save = async ({ patientUuid, encounterUuid, data, recordType, baseEncounterUuid }: SaveOdontogramParams) => {
    setIsSaving(true);
    setError(null);

    try {
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
        const existingObs = await fetchEncounterObs(encounterUuid);
        response = await updateEncounter(encounterUuid, applyExistingObsUuids(payload, existingObs));
      } else {
        response = await saveEncounter(payload);
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
