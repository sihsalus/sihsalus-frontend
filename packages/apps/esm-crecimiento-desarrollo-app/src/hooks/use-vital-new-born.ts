import { openmrsFetch, restBaseUrl, useConfig } from '@openmrs/esm-framework';
import useSWRImmutable from 'swr/immutable';

import type { ConfigObject } from '../config-schema';
import type { ConceptMetadata } from '../utils';
import { assessValue, getReferenceRangesForConcept } from '../utils';

// Interfaces para las respuestas de la API
interface ConceptResponse {
  setMembers: ConceptMetadata[];
}

interface ObsResponse {
  results: Array<{
    uuid: string;
    concept: {
      uuid: string;
      display: string;
    };
    value: string | number | null;
    obsDatetime: string;
  }>;
}

interface NewbornVitalsMetadata {
  conceptMetadata: ConceptMetadata[];
  isLoading: boolean;
  error: Error;
}

export function useNewbornVitalsMetadata(): NewbornVitalsMetadata {
  const config = useConfig<ConfigObject>();
  const conceptSetUuid = config.concepts?.newbornVitalSignsConceptSetUuid;
  const metadataUrl = `${restBaseUrl}/concept/${conceptSetUuid}?v=custom:(setMembers:(uuid,display,hiNormal,hiAbsolute,hiCritical,lowNormal,lowAbsolute,lowCritical,units))`;

  const { data, error, isLoading } = useSWRImmutable<{ data: ConceptResponse }>(
    conceptSetUuid ? metadataUrl : null,
    openmrsFetch,
  );

  return {
    conceptMetadata: data?.data?.setMembers ?? [],
    isLoading,
    error: error as Error,
  };
}

export function useVitalNewBorn(patientUuid: string) {
  const { conceptMetadata, isLoading: metadataLoading, error: metadataError } = useNewbornVitalsMetadata();
  const conceptUuids = conceptMetadata.map((concept) => concept.uuid).join(',');
  const obsUrl = conceptUuids
    ? `${restBaseUrl}/obs?patient=${patientUuid}&concept=${conceptUuids}&v=custom:(uuid,concept:(uuid,display),value,obsDatetime)`
    : null;

  const {
    data: observations,
    error: obsError,
    isLoading: obsLoading,
    isValidating,
    mutate,
  } = useSWRImmutable<{ data: ObsResponse }>(obsUrl, openmrsFetch);

  const vitals =
    observations?.data?.results?.map((obs) => {
      const referenceRanges = getReferenceRangesForConcept(obs.concept.uuid, conceptMetadata);
      return {
        id: obs.uuid,
        concept: obs.concept.display,
        value: obs.value,
        datetime: obs.obsDatetime,
        interpretation: assessValue(typeof obs.value === 'number' ? obs.value : undefined, referenceRanges),
      };
    }) ?? [];

  return {
    vitals,
    isLoading: metadataLoading || obsLoading,
    isValidating,
    error: metadataError || obsError,
    mutate,
    conceptMetadata,
  };
}
