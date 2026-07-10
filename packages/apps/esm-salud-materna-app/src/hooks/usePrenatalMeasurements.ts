import { openmrsFetch, restBaseUrl, useConfig } from '@openmrs/esm-framework';
import { useMemo } from 'react';
import useSWR from 'swr';

import type { ConfigObject } from '../config-schema';
import {
  encounterMatchesForm,
  flattenMaternalObservations,
  isWithinPregnancyEpisode,
  type MaternalEncounter,
} from '../utils/pregnancy-episode-utils';

import { useCurrentPregnancy } from './useCurrentPregnancy';

interface PrenatalMeasurement {
  uuid: string;
  date: string;
  gestationalWeek: number;
  uterineHeight?: number;
  cervicalLength?: number;
  encounterUuid: string;
}

interface EncounterResponse {
  results: MaternalEncounter[];
}

const representation =
  'custom:(uuid,encounterDatetime,form:(uuid,name,display),obs:(uuid,concept:(uuid),value,groupMembers:(uuid,concept:(uuid),value,groupMembers:(uuid,concept:(uuid),value))))';

const toNumber = (value: unknown): number | undefined => {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : undefined;
};

export function usePrenatalMeasurements(patientUuid: string) {
  const config = useConfig<ConfigObject>();
  const { pregnancyStartDate, isLoading: isPregnancyLoading, error: pregnancyError } = useCurrentPregnancy(patientUuid);
  const encounterTypeUuid = config.encounterTypes.prenatalControl;
  const prenatalFormIdentifier = config.formsList.atencionPrenatal;
  const url =
    patientUuid && encounterTypeUuid
      ? `${restBaseUrl}/encounter?patient=${patientUuid}&encounterType=${encounterTypeUuid}&v=${representation}&limit=100`
      : null;

  const { data, error, isLoading, mutate } = useSWR<EncounterResponse, Error>(url, async (fetchUrl) => {
    const response = await openmrsFetch<EncounterResponse>(fetchUrl);
    return response.data;
  });

  const measurements = useMemo<PrenatalMeasurement[]>(() => {
    if (!pregnancyStartDate) return [];

    const { gestationalAgeConceptUuid, uterineHeightConceptUuid, cervicalLengthConceptUuid } =
      config.prenatalMeasurements;

    return (data?.results ?? [])
      .filter(
        (encounter) =>
          encounterMatchesForm(encounter, prenatalFormIdentifier) &&
          isWithinPregnancyEpisode(encounter.encounterDatetime, pregnancyStartDate),
      )
      .map((encounter) => {
        const valuesByConcept = new Map(
          flattenMaternalObservations(encounter.obs).map((observation) => [
            observation.concept?.uuid,
            observation.value,
          ]),
        );

        return {
          uuid: encounter.uuid,
          date: encounter.encounterDatetime,
          gestationalWeek: toNumber(valuesByConcept.get(gestationalAgeConceptUuid)) ?? 0,
          uterineHeight: toNumber(valuesByConcept.get(uterineHeightConceptUuid)),
          cervicalLength: cervicalLengthConceptUuid
            ? toNumber(valuesByConcept.get(cervicalLengthConceptUuid))
            : undefined,
          encounterUuid: encounter.uuid,
        };
      })
      .filter(
        (measurement) =>
          measurement.gestationalWeek > 0 &&
          (measurement.uterineHeight !== undefined || measurement.cervicalLength !== undefined),
      )
      .sort((first, second) => new Date(second.date).getTime() - new Date(first.date).getTime());
  }, [config.prenatalMeasurements, data?.results, pregnancyStartDate, prenatalFormIdentifier]);

  return {
    data: measurements,
    pregnancyStartDate,
    error: pregnancyError ?? error ?? null,
    isLoading: isPregnancyLoading || isLoading,
    mutate,
  };
}
