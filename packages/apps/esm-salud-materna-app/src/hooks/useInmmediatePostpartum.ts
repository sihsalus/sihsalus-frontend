import { openmrsFetch, restBaseUrl, useConfig } from '@openmrs/esm-framework';
import { useMemo } from 'react';
import useSWR from 'swr';

import type { ConfigObject } from '../config-schema';

type Obs = {
  uuid: string;
  display: string;
  groupMembers?: Obs[];
};

type ObsEncounter = {
  uuid: string;
  encounterDatetime: string;
  form: {
    uuid: string;
    display: string;
  };
  obs: Obs[];
};

type EncounterResponse = {
  results: ObsEncounter[];
};

const richRepresentation =
  'custom:(uuid,encounterDatetime,form:(uuid,display),obs:(uuid,display,groupMembers:(uuid,display)))';

export const useInmmediatePostpartumPeriod = (
  patientUuid: string,
): { prenatalEncounters: ObsEncounter[]; error: Error | null; isValidating: boolean; mutate: () => void } => {
  const config = useConfig<ConfigObject>();
  const encounterType = config.encounterTypes.postnatalControl;
  const formName = config.formsList.immediatePostpartumPeriod;

  const url = useMemo(() => {
    if (!patientUuid || !encounterType) return null;
    return `${restBaseUrl}/encounter?patient=${patientUuid}&encounterType=${encounterType}&v=${richRepresentation}`;
  }, [patientUuid, encounterType]);

  const { data, error, isValidating, mutate } = useSWR<EncounterResponse>(url, async (fetchUrl) => {
    const response = await openmrsFetch<EncounterResponse>(fetchUrl);
    return response?.data;
  });

  const prenatalEncounters = useMemo(() => {
    if (!data?.results) return [];
    return data.results
      .filter((enc) => enc?.form?.uuid === formName || enc?.form?.display === formName)
      .sort((a, b) => new Date(a.encounterDatetime).getTime() - new Date(b.encounterDatetime).getTime());
  }, [data, formName]);

  return { prenatalEncounters, error, isValidating, mutate };
};
