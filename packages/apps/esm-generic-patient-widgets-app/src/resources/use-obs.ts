import { fhirBaseUrl, openmrsFetch, useConfig } from '@openmrs/esm-framework';
import type { KeyedMutator } from 'swr';
import useSWR from 'swr';

import { type ConfigObject } from '../config-schema';

export interface UseObsResult {
  data: Array<ObsResult>;
  concepts: Array<{ uuid: string; display: string; dataType?: string }>;
  encounters: Array<{ reference: string; display: string; encounterTypeUuid?: string }>;
  error: Error;
  isLoading: boolean;
  isValidating: boolean;
  mutate: KeyedMutator<{ data: fhir.Bundle }>;
}

type ObsResult = fhir.Observation & {
  conceptUuid: string;
  dataType?: string;
  valueDateTime?: string;
  encounter?: {
    name?: string;
    /**
     * Reference to the encounter resource, in the format `Encounter/{uuid}`
     */
    reference: string;
  };
};

export const pageSize = 100;

export function useObs(patientUuid: string, includeEncounters: boolean = false): UseObsResult {
  const { encounterTypes, data } = useConfig<ConfigObject>();
  const urlEncounterTypes: string = encounterTypes.length ? `&encounter.type=${encounterTypes.toString()}` : '';

  let url = `${fhirBaseUrl}/Observation?subject:Patient=${patientUuid}&code=${data
    .map((d) => d.concept)
    .join(',')}&_summary=data&_sort=-date&_count=${pageSize}${urlEncounterTypes}`;

  if (includeEncounters) {
    url += '&_include=Observation:encounter';
  }

  const {
    data: result,
    error,
    isLoading,
    isValidating,
    mutate,
  } = useSWR<{ data: fhir.Bundle }, Error>(url, openmrsFetch);

  const encounters = includeEncounters ? getEncountersByResources(result?.data?.entry) : [];
  const observations = filterAndMapObservations(result?.data?.entry, encounters);

  return {
    data: observations,
    concepts: data.map(({ concept, label }) => ({ uuid: concept, display: label || concept })),
    encounters,
    error: error,
    isLoading,
    isValidating,
    mutate,
  };
}

function filterAndMapObservations(
  entries: Array<fhir.BundleEntry>,
  encounters: Array<{ reference: string; display: string; encounterTypeUuid?: string }>,
): ObsResult[] {
  return (
    entries
      ?.filter((entry) => entry?.resource?.resourceType === 'Observation')
      ?.map((entry) => {
        const resource = entry.resource as fhir.Observation;
        const observation: ObsResult = {
          ...resource,
          conceptUuid: resource.code.coding.find((c) => isUuid(c.code))?.code,
        };
        if (Object.hasOwn(resource, 'valueDateTime')) {
          observation.dataType = 'DateTime';
        }

        if (Object.hasOwn(entry.resource, 'valueString')) {
          observation.dataType = 'Text';
        }

        if (Object.hasOwn(entry.resource, 'valueQuantity')) {
          observation.dataType = 'Number';
        }

        if (Object.hasOwn(entry.resource, 'valueCodeableConcept')) {
          observation.dataType = 'Coded';
        }

        const encounter = encounters.find(
          (e) =>
            e.reference === (resource as fhir.Observation & { encounter: { reference?: string } }).encounter.reference,
        );

        if (observation.encounter) {
          observation.encounter.name = encounter?.display;
        }

        return observation;
      }) || []
  );
}

function getEncountersByResources(resources: Array<fhir.BundleEntry>) {
  return resources
    ?.filter((entry) => entry?.resource?.resourceType === 'Encounter')
    .map((entry: fhir.BundleEntry) => ({
      reference: `Encounter/${entry.resource.id}`,
      display: (entry.resource as fhir.Encounter).type?.[0]?.coding?.[0]?.display || '--',
      encounterTypeUuid: (entry.resource as fhir.Encounter).type?.[0]?.coding?.[0]?.code,
    }));
}

function isUuid(input: string) {
  return input.length === 36;
}
