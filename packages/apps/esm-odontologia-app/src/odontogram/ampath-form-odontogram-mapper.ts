import type { OdontogramConfig } from '../config-schema';
import type { OdontogramRecordType } from '../types/odontogram-record';
import { getAmpathOdontogramFormPersistence, getAmpathOdontogramFormUuid } from './ampath-form-odontogram-config';
import type { OdontogramData } from './types/odontogram';

type ObsValue = string | { uuid?: string; display?: string } | null | undefined;

export interface OdontogramObs {
  uuid?: string;
  concept?: {
    uuid?: string;
    display?: string;
  };
  value?: ObsValue;
}

export interface OdontogramEncounterProvider {
  uuid?: string;
  provider?: {
    uuid?: string;
    person?: {
      uuid?: string;
      display?: string;
    };
  };
}

export interface OdontogramEncounter {
  uuid: string;
  encounterDatetime: string;
  encounterType?: {
    uuid?: string;
  };
  encounterProviders?: Array<OdontogramEncounterProvider>;
  obs?: Array<OdontogramObs>;
}

export interface OdontogramEncounterPayload {
  patient: string;
  encounterType: string;
  form: string;
  encounterDatetime: string;
  obs: Array<{
    /** Existing obs uuid — present only on updates so OpenMRS edits in place. */
    uuid?: string;
    concept: string;
    value: string;
  }>;
}

function getObsByConcept(encounter: OdontogramEncounter, conceptUuid: string) {
  return encounter.obs?.find((obs) => obs.concept?.uuid === conceptUuid);
}

function getTextValue(value: ObsValue): string {
  if (value && typeof value === 'object') {
    return value.display ?? value.uuid ?? '';
  }

  return value == null ? '' : String(value);
}

export function mapToAmpathOdontogramEncounterPayload({
  activeBaseEncounterUuid,
  config,
  data,
  encounterTypeUuid,
  patientUuid,
  recordType,
}: {
  activeBaseEncounterUuid?: string | null;
  config: OdontogramConfig;
  data: OdontogramData;
  encounterTypeUuid: string;
  patientUuid: string;
  recordType: OdontogramRecordType;
}): OdontogramEncounterPayload {
  const persistence = getAmpathOdontogramFormPersistence(config);
  const obs: OdontogramEncounterPayload['obs'] = [
    {
      concept: persistence.concepts.snapshot,
      value: JSON.stringify(data),
    },
    {
      concept: persistence.concepts.recordType,
      value: recordType,
    },
  ];

  if (recordType === 'attention' && activeBaseEncounterUuid) {
    obs.push({
      concept: persistence.concepts.parentBaseEncounterUuid,
      value: activeBaseEncounterUuid,
    });
  }

  return {
    patient: patientUuid,
    encounterType: encounterTypeUuid,
    form: getAmpathOdontogramFormUuid(config, recordType),
    encounterDatetime: new Date().toISOString(),
    obs,
  };
}

export function getOdontogramRecordTypeFromEncounter(
  encounter: OdontogramEncounter,
  config: OdontogramConfig,
  fallback: OdontogramRecordType,
): OdontogramRecordType {
  const persistence = getAmpathOdontogramFormPersistence(config);
  const recordType = getTextValue(getObsByConcept(encounter, persistence.concepts.recordType)?.value);

  return recordType === 'attention' || recordType === 'base' ? recordType : fallback;
}

export function getParentBaseEncounterUuidFromEncounter(
  encounter: OdontogramEncounter,
  config: OdontogramConfig,
): string | null {
  const persistence = getAmpathOdontogramFormPersistence(config);
  const value = getTextValue(getObsByConcept(encounter, persistence.concepts.parentBaseEncounterUuid)?.value);

  return value || null;
}

/**
 * Attaches the uuid of the current obs to each payload entry that targets the
 * same concept, so updating an encounter edits its obs in place instead of
 * appending a duplicate obs. The first obs per concept is reused, matching how
 * {@link getObsByConcept} reads values back.
 */
export function applyExistingObsUuids(
  payload: OdontogramEncounterPayload,
  existingObs: Array<OdontogramObs>,
): OdontogramEncounterPayload {
  const uuidByConcept = new Map<string, string>();

  for (const obs of existingObs) {
    const conceptUuid = obs.concept?.uuid;
    if (conceptUuid && obs.uuid && !uuidByConcept.has(conceptUuid)) {
      uuidByConcept.set(conceptUuid, obs.uuid);
    }
  }

  return {
    ...payload,
    obs: payload.obs.map((entry) => {
      const existingUuid = uuidByConcept.get(entry.concept);
      return existingUuid ? { uuid: existingUuid, ...entry } : entry;
    }),
  };
}

export function getProviderNameFromEncounter(encounter: OdontogramEncounter): string | null {
  return encounter.encounterProviders?.[0]?.provider?.person?.display ?? null;
}

export function getOdontogramDataFromEncounter(
  encounter: OdontogramEncounter,
  config: OdontogramConfig,
): OdontogramData | null {
  const persistence = getAmpathOdontogramFormPersistence(config);
  const rawSnapshot = getTextValue(getObsByConcept(encounter, persistence.concepts.snapshot)?.value);

  if (!rawSnapshot) {
    return null;
  }

  try {
    return JSON.parse(rawSnapshot) as OdontogramData;
  } catch {
    return null;
  }
}
