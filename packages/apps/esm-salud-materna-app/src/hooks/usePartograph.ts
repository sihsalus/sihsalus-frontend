import type { OpenmrsResource } from '@openmrs/esm-framework';
import { openmrsFetch, restBaseUrl, useConfig } from '@openmrs/esm-framework';
import useSWR from 'swr';

import type { ConfigObject } from '../config-schema';
import type { OpenmrsEncounter } from '../types';
import { isWithinPregnancyEpisode } from '../utils/pregnancy-episode-utils';

import { useCurrentPregnancy } from './useCurrentPregnancy';

const partographEncounterRepresentation =
  'custom:(uuid,encounterDatetime,form:(uuid,name,display),obs:(uuid,obsDatetime,voided,' +
  'concept:(uuid,name:(uuid,name)),groupMembers:(uuid,obsDatetime,display,concept:(uuid,name:(uuid,name)),value)))';

export type PartogramProgram = {
  concept: OpenmrsResource;
  obsDatetime: string;
  value: string;
  status: string;
  uuid: string;
  display: string;
};
export function usePartograph(patientUuid: string) {
  const { partography } = useConfig<ConfigObject>();
  const { pregnancyStartDate, isLoading: isPregnancyLoading, error: pregnancyError } = useCurrentPregnancy(patientUuid);
  const url =
    patientUuid && partography?.encounterTypeUuid
      ? `${restBaseUrl}/encounter?encounterType=${partography.encounterTypeUuid}&patient=${patientUuid}&v=${partographEncounterRepresentation}`
      : null;

  const { data, error, isLoading, isValidating, mutate } = useSWR<{ data: { results: OpenmrsEncounter[] } }, Error>(
    url,
    openmrsFetch,
  );
  const results = data?.data ? data?.data?.results : [];
  const sortedResults = results
    .filter(
      (encounter) =>
        formMatches(encounter.form, partography?.formUuid) &&
        isWithinPregnancyEpisode(encounter.encounterDatetime, pregnancyStartDate),
    )
    .slice()
    .sort((a, b) => {
      const dateA = new Date(a.encounterDatetime).getTime();
      const dateB = new Date(b.encounterDatetime).getTime();
      return dateB - dateA;
    });
  const flattedObs = sortedResults
    .flatMap((encounter) => encounter.obs)
    .filter(
      (obs) => !obs?.voided && obs?.concept?.uuid === partography?.progressConceptUuid && obs?.groupMembers?.length,
    )
    .sort((a, b) => {
      const dateA = new Date(a.obsDatetime ?? '').getTime();
      const dateB = new Date(b.obsDatetime ?? '').getTime();
      return dateB - dateA;
    });
  return {
    encounters: flattedObs as Array<OpenmrsEncounter>,
    isLoading: isPregnancyLoading || isLoading,
    isValidating,
    error: pregnancyError ?? error ?? null,
    mutate,
  };
}

function formMatches(form: (OpenmrsEncounter['form'] & { display?: string }) | undefined, configuredForm?: string) {
  if (!configuredForm) {
    return true;
  }

  return form?.uuid === configuredForm || form?.name === configuredForm || form?.display === configuredForm;
}
