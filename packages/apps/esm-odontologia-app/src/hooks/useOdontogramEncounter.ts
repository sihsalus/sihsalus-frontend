import { useConfig } from '@openmrs/esm-framework';
import { useState } from 'react';

import type { OdontogramConfig } from '../config-schema';
import { mapToAmpathOdontogramEncounterPayload } from '../odontogram/ampath-form-odontogram-mapper';
import { saveEncounter, updateEncounter } from '../odontogram.resource';
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
      const response = encounterUuid ? await updateEncounter(encounterUuid, payload) : await saveEncounter(payload);

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
