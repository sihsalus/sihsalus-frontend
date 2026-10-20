import dayjs from 'dayjs';
import type { ImmunizationConfigObject } from '../config-schema';
import type { ExistingDoses, ImmunizationFormData, ImmunizationGrouped } from '../types';
import {
  defaultUnknownEncounterRoleUuid,
  getAmpathImmunizationFormPersistence,
} from './ampath-form-immunization-config';
import { latestFirst, readImmunizationStatus, requireWritableImmunizationStatus } from './utils';

type ObsValue = string | number | boolean | { uuid?: string; display?: string; name?: string } | null | undefined;

export interface AmpathImmunizationObs {
  uuid?: string;
  concept?: {
    uuid?: string;
    display?: string;
  };
  value?: ObsValue;
}

export interface AmpathImmunizationEncounter {
  uuid: string;
  patient?: { uuid?: string };
  encounterDatetime?: string;
  form?: { name?: string; version?: string };
  visit?: {
    uuid?: string;
  };
  location?: {
    uuid?: string;
  };
  obs?: Array<AmpathImmunizationObs>;
}

export interface AmpathImmunizationEncounterPayload {
  patient: string;
  encounterType: string;
  form?: string;
  encounterDatetime?: string;
  visit?: string;
  location?: string;
  encounterProviders?: Array<{ provider: string; encounterRole: string }>;
  obs: Array<
    { concept: string; value: string | number; uuid?: string } | { uuid: string; voided?: boolean; voidReason?: string }
  >;
}

function getObsByConcept(encounter: AmpathImmunizationEncounter, conceptUuid: string) {
  const observations = encounter.obs?.filter((obs) => obs.concept?.uuid === conceptUuid) ?? [];
  if (observations.length > 1) throw new Error('The immunization encounter contains ambiguous observations');
  return observations[0];
}

/** Preserve native Obs identities: REST does not replace observations by concept. */
export function reconcileAmpathImmunizationObs(
  desired: AmpathImmunizationEncounterPayload['obs'],
  existing: AmpathImmunizationObs[],
  managedConcepts: string[],
): AmpathImmunizationEncounterPayload['obs'] {
  const managed = new Set(managedConcepts);
  if (!managed.size) throw new Error('The immunization observation contract is unavailable');
  const desiredByConcept = new Map(
    desired.map((obs) => {
      if (!('concept' in obs) || !managed.has(obs.concept)) throw new Error('Unexpected immunization observation');
      return [obs.concept, obs] as const;
    }),
  );
  if (desiredByConcept.size !== desired.length) throw new Error('Duplicate configured immunization concepts');
  const seen = new Set<string>();
  const updates: AmpathImmunizationEncounterPayload['obs'] = existing.map((obs) => {
    if (!obs.uuid) throw new Error('An existing observation identity is unavailable');
    const concept = obs.concept?.uuid;
    if (!managed.has(concept)) return { uuid: obs.uuid };
    if (seen.has(concept)) throw new Error('The immunization encounter contains ambiguous observations');
    seen.add(concept);
    const replacement = desiredByConcept.get(concept);
    desiredByConcept.delete(concept);
    return replacement
      ? { ...replacement, uuid: obs.uuid }
      : {
          uuid: obs.uuid,
          voided: true,
          voidReason: 'Updated immunization record',
        };
  });
  return [...updates, ...desiredByConcept.values()];
}

function getValueUuid(value: ObsValue): string {
  if (value && typeof value === 'object') {
    return value.uuid ?? '';
  }

  return value == null ? '' : String(value);
}

function getValueDisplay(value: ObsValue): string {
  if (value && typeof value === 'object') {
    return value.display ?? value.name ?? value.uuid ?? '';
  }

  return value == null ? '' : String(value);
}

function getStringValue(encounter: AmpathImmunizationEncounter, conceptUuid: string): string {
  return getValueDisplay(getObsByConcept(encounter, conceptUuid)?.value);
}

function getNumberValue(encounter: AmpathImmunizationEncounter, conceptUuid: string): number | undefined {
  const value = getObsByConcept(encounter, conceptUuid)?.value;
  const numericValue = typeof value === 'number' ? value : Number(value);

  return Number.isFinite(numericValue) ? numericValue : undefined;
}

function toOpenmrsDateObsValue(value: string): string {
  const dateOnlyValue = value.match(/^(\d{4}-\d{2}-\d{2})$/)?.[1];
  if (dateOnlyValue) {
    return dateOnlyValue;
  }

  const utcMidnightDateValue = value.match(/^(\d{4}-\d{2}-\d{2})T00:00:00(?:\.000)?Z$/)?.[1];
  if (utcMidnightDateValue) {
    return utcMidnightDateValue;
  }

  const date = dayjs(value);
  return date.isValid() ? date.format('YYYY-MM-DD') : value;
}

export function mapToAmpathImmunizationEncounterPayload(
  immunization: ImmunizationFormData,
  config: ImmunizationConfigObject,
  newEncounter?: {
    formUuid: string;
    visitUuid: string;
    locationUuid: string;
    providerUuid: string;
    recordedAt: string;
  },
): AmpathImmunizationEncounterPayload {
  const persistence = getAmpathImmunizationFormPersistence(config);
  const concepts = persistence.concepts;
  const obs: AmpathImmunizationEncounterPayload['obs'] = [
    {
      concept: concepts.vaccineUuid,
      value: immunization.vaccineUuid,
    },
    {
      concept: concepts.status,
      value: requireWritableImmunizationStatus(immunization.status),
    },
    {
      concept: concepts.programContext,
      value: immunization.programContext ?? 'routine',
    },
  ];

  if (immunization.status === 'completed') {
    obs.push({ concept: concepts.vaccinationDate, value: toOpenmrsDateObsValue(immunization.vaccinationDate) });
  }

  if (typeof immunization.doseNumber === 'number' && immunization.doseNumber >= 1) {
    obs.push({ concept: concepts.doseNumber, value: immunization.doseNumber });
  }

  if (immunization.manufacturer?.trim()) {
    obs.push({
      concept: concepts.manufacturer,
      value: immunization.manufacturer.trim(),
    });
  }

  if (immunization.lotNumber?.trim()) {
    obs.push({
      concept: concepts.lotNumber,
      value: immunization.lotNumber.trim(),
    });
  }

  if (immunization.expirationDate) {
    obs.push({
      concept: concepts.expirationDate,
      value: toOpenmrsDateObsValue(immunization.expirationDate),
    });
  }

  if (immunization.note?.trim()) {
    obs.push({ concept: concepts.note, value: immunization.note.trim() });
  }

  if (immunization.nextDoseDate) {
    obs.push({
      concept: concepts.nextDoseDate,
      value: toOpenmrsDateObsValue(immunization.nextDoseDate),
    });
  }

  if (immunization.statusReason?.trim()) {
    obs.push({
      concept: concepts.statusReason,
      value: immunization.statusReason.trim(),
    });
  }

  return {
    patient: immunization.patientUuid,
    encounterType: persistence.encounterTypeUuid,
    // Edits retain the historical encounter context, including its timestamp.
    ...(newEncounter
      ? {
          form: newEncounter.formUuid,
          encounterDatetime: newEncounter.recordedAt,
          visit: newEncounter.visitUuid,
          location: newEncounter.locationUuid,
          encounterProviders: [
            ...new Set([
              persistence.encounterRoleUuid,
              config.unknownEncounterRoleUuid || defaultUnknownEncounterRoleUuid,
            ]),
          ].map((encounterRole) => ({ provider: newEncounter.providerUuid, encounterRole })),
        }
      : {}),
    obs,
  };
}

export function mapFromAmpathImmunizationEncounters(
  encounters: Array<AmpathImmunizationEncounter> | undefined,
  config: ImmunizationConfigObject,
): Array<ImmunizationGrouped> {
  const persistence = getAmpathImmunizationFormPersistence(config);
  const concepts = persistence.concepts;

  const doses: Array<{
    vaccineUuid: string;
    vaccineName: string;
    dose: ExistingDoses;
  }> = (encounters ?? [])
    .map((encounter) => {
      const vaccineObs = getObsByConcept(encounter, concepts.vaccineUuid);
      const vaccineUuid = getValueUuid(vaccineObs?.value);

      if (!vaccineUuid) {
        return null;
      }

      const status = getStringValue(encounter, concepts.status);
      // Only the verified legacy Form used encounterDatetime as administration.
      // New and unidentified forms must not turn registration into a clinical date.
      const hasLegacyAdministrationDate =
        encounter.form?.name === persistence.formName &&
        !!encounter.form?.version &&
        persistence.encounterDateAdministrationFormVersions?.includes(encounter.form?.version);
      const occurrenceDateTime =
        status === 'not-done'
          ? ''
          : getStringValue(encounter, concepts.vaccinationDate) ||
            (hasLegacyAdministrationDate ? (encounter.encounterDatetime ?? '') : '');
      const programContext = getStringValue(encounter, concepts.programContext);
      const note = getStringValue(encounter, concepts.note);

      return {
        vaccineUuid,
        vaccineName: getValueDisplay(vaccineObs?.value),
        dose: {
          persistenceSource: 'ampath-form',
          immunizationObsUuid: encounter.uuid,
          visitUuid: encounter.visit?.uuid,
          locationUuid: encounter.location?.uuid,
          occurrenceDateTime,
          doseNumber: getNumberValue(encounter, concepts.doseNumber),
          manufacturer: getStringValue(encounter, concepts.manufacturer),
          lotNumber: getStringValue(encounter, concepts.lotNumber),
          expirationDate: getStringValue(encounter, concepts.expirationDate),
          nextDoseDate: getStringValue(encounter, concepts.nextDoseDate),
          note: note ? [{ text: note }] : [],
          status: readImmunizationStatus(status),
          statusReason: getStringValue(encounter, concepts.statusReason),
          programContext: programContext || 'routine',
        } as ExistingDoses,
      };
    })
    .filter(
      (
        item,
      ): item is {
        vaccineUuid: string;
        vaccineName: string;
        dose: ExistingDoses;
      } => Boolean(item),
    );

  const grouped = doses.reduce<Record<string, ImmunizationGrouped>>((acc, item) => {
    if (!acc[item.vaccineUuid]) {
      acc[item.vaccineUuid] = {
        vaccineUuid: item.vaccineUuid,
        vaccineName: item.vaccineName,
        existingDoses: [],
      };
    }

    acc[item.vaccineUuid].existingDoses.push(item.dose);
    return acc;
  }, {});

  return Object.values(grouped).map((group) => ({
    ...group,
    existingDoses: group.existingDoses.slice().sort(latestFirst),
  }));
}

export function mergeImmunizationGroups(
  ...sources: Array<Array<ImmunizationGrouped> | undefined>
): Array<ImmunizationGrouped> {
  const groups = new Map<string, ImmunizationGrouped>();

  for (const source of sources) {
    for (const immunization of source ?? []) {
      const existing = groups.get(immunization.vaccineUuid);
      if (!existing) {
        groups.set(immunization.vaccineUuid, {
          ...immunization,
          existingDoses: [...immunization.existingDoses],
        });
        continue;
      }

      existing.vaccineName = existing.vaccineName || immunization.vaccineName;
      existing.existingDoses.push(...immunization.existingDoses);
    }
  }

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      existingDoses: group.existingDoses.slice().sort(latestFirst),
    }))
    .sort((a, b) =>
      (b.existingDoses?.[0]?.occurrenceDateTime ?? '').localeCompare(a.existingDoses?.[0]?.occurrenceDateTime ?? ''),
    );
}
