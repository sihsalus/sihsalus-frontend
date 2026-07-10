import { type FetchResponse, openmrsFetch, restBaseUrl, useConfig } from '@openmrs/esm-framework';
import { useMemo } from 'react';
import useSWR, { type KeyedMutator } from 'swr';

import { type ConfigObject, configSchema } from '../config-schema';

export interface CREDEncounter {
  uuid: string;
  encounterDatetime?: string;
  encounterType?: { uuid: string; display?: string };
  visit?: { uuid: string };
  form?: { uuid: string; name?: string; display?: string };
}

interface UseEncountersResponse {
  encounters: CREDEncounter[] | undefined;
  isLoading: boolean;
  error: Error | null;
  mutate: KeyedMutator<FetchResponse<{ results: CREDEncounter[] }>>;
}

const normalizeIdentifier = (identifier: string | undefined) => identifier?.trim().toLocaleLowerCase() ?? '';

export function encounterMatchesFormIdentifier(encounter: CREDEncounter, identifier: string | undefined): boolean {
  const normalizedIdentifier = normalizeIdentifier(identifier);
  if (!encounter.form || !normalizedIdentifier) return false;

  return [encounter.form.uuid, encounter.form.name, encounter.form.display]
    .map(normalizeIdentifier)
    .some((formIdentifier) => formIdentifier === normalizedIdentifier);
}

export function getConfiguredCREDFormIdentifiers(config: ConfigObject): Set<string> {
  const configuredGroups = config.CREDFormsByAgeGroup;
  const groups =
    Array.isArray(configuredGroups) && configuredGroups.length > 0
      ? configuredGroups
      : configSchema.CREDFormsByAgeGroup._default;
  const defaultForms = configSchema.formsList._default;

  return new Set(
    groups
      .flatMap((group) => group.forms ?? [])
      .map((formKey) => config.formsList?.[formKey] ?? defaultForms[formKey])
      .filter((identifier): identifier is string => Boolean(identifier))
      .map(normalizeIdentifier),
  );
}

export function isCREDFormEncounter(encounter: CREDEncounter, formIdentifiers: Set<string>): boolean {
  if (!encounter.form) return false;

  return [encounter.form.uuid, encounter.form.name, encounter.form.display]
    .map(normalizeIdentifier)
    .some((identifier) => identifier && formIdentifiers.has(identifier));
}

export default function useEncountersCRED(patientUuid: string): UseEncountersResponse {
  const config = useConfig<ConfigObject>();
  const formIdentifiers = useMemo(() => getConfiguredCREDFormIdentifiers(config), [config]);
  const searchParams = new URLSearchParams({
    patient: patientUuid,
    v: 'custom:(uuid,encounterDatetime,encounterType:(uuid,display),visit:(uuid),form:(uuid,name,display))',
    limit: '1000',
  });
  const encounterUrl = `${restBaseUrl}/encounter?${searchParams.toString()}`;

  const { data, error, isLoading, mutate } = useSWR<FetchResponse<{ results: CREDEncounter[] }>, Error>(
    patientUuid ? encounterUrl : null,
    openmrsFetch,
  );

  const encounters = useMemo(
    () => data?.data?.results.filter((encounter) => isCREDFormEncounter(encounter, formIdentifiers)),
    [data?.data?.results, formIdentifiers],
  );

  return {
    encounters,
    isLoading,
    error: error ?? null,
    mutate,
  };
}
