import { useConfig } from '@openmrs/esm-framework';
import { useState } from 'react';

import type { OdontogramConfig } from '../config-schema';
import { applyExistingObsUuids, mapToAmpathOdontogramEncounterPayload } from '../odontogram/ampath-form-odontogram-mapper';
import { fetchEncounterObs, saveEncounter, updateEncounter } from '../odontogram.resource';
import useOdontogramDataStore from '../store/odontogramDataStore';

interface SaveOdontogramParams {
  patientUuid: string;
  encounterUuid?: string;
}

export function useOdontogramEncounter() {
  const config = useConfig<OdontogramConfig>();
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const save = async ({ patientUuid, encounterUuid }: SaveOdontogramParams) => {
    setIsSaving(true);
    setError(null);

    try {
      const { activeBaseEncounterUuid, data, workspaceMode } = useOdontogramDataStore.getState();

      const encounterTypeUuid =
        workspaceMode === 'base' ? config.baseEncounterTypeUuid?.trim() : config.attentionEncounterTypeUuid?.trim();

      if (!encounterTypeUuid) {
        throw new Error(
          workspaceMode === 'base'
            ? 'Missing required config: baseEncounterTypeUuid'
            : 'Missing required config: attentionEncounterTypeUuid',
        );
      }

      const payload = mapToAmpathOdontogramEncounterPayload({
        activeBaseEncounterUuid,
        config,
        data,
        encounterTypeUuid,
        patientUuid,
        recordType: workspaceMode,
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
