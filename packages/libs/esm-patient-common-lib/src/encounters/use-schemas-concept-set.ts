import type { Concept } from '@openmrs/esm-framework';
import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import useSWR from 'swr';

export type ColourDefinition = {
  conceptUuid: string;
  colour: string;
};

export type LegendConfigObject = {
  legendConceptSet: string;
  colorDefinitions: Array<ColourDefinition>;
};

interface ConceptWithColour extends Concept {
  colour?: string;
}

interface ConceptResponse {
  results: Concept[];
}

interface UseSchemasConceptSetResult {
  schemasConceptSet?: ConceptWithColour;
  isLoading: boolean;
  error?: Error;
  mutate: () => void;
}

// Adapter function to make openmrsFetch compatible with SWR
const swrFetcher = async (url: string) => {
  const response = await openmrsFetch<ConceptResponse>(url);
  return response.data;
};

export function useSchemasConceptSet(config: LegendConfigObject): UseSchemasConceptSetResult {
  const conceptRepresentation =
    'custom:(uuid,display,answers:(uuid,display),conceptMappings:(conceptReferenceTerm:(conceptSource:(name),code)))';

  const legendConceptSet = config.legendConceptSet?.trim();
  const url = legendConceptSet
    ? `${restBaseUrl}/concept?references=${legendConceptSet}&v=${conceptRepresentation}`
    : null;

  const { data, error, isLoading, mutate } = useSWR<ConceptResponse, Error>(url, swrFetcher);

  const schemasConceptSet = data?.results[0]
    ? {
        ...data.results[0],
        colour: config.colorDefinitions.find((def) => def.conceptUuid === data.results[0].uuid)?.colour,
      }
    : undefined;

  return {
    schemasConceptSet,
    isLoading,
    error,
    mutate,
  };
}
