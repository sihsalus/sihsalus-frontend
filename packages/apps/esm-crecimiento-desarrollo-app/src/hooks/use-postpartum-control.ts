import { openmrsFetch, restBaseUrl, useConfig } from '@openmrs/esm-framework';
import { useMemo } from 'react';
import useSWR from 'swr';
import useSWRImmutable from 'swr/immutable';

import type { ConfigObject } from '../config-schema';

export const customRepresentation = `custom:(uuid,display,program,dateEnrolled,dateCompleted,location:(uuid,display),states:(startDate,endDate,voided,state:(uuid,concept:(display))))`;

type Encounter = {
  uuid: string;
  display: string;
  links: { uri: string }[];
};

type EncounterResponse = {
  results: Encounter[];
};

type Obs = {
  uuid: string;
  display: string;
  groupMembers?: Obs[];
};

type ObsEncounter = {
  encounterDatetime: string;
  form: {
    uuid: string;
    display: string;
  };
  obs: Obs[];
};

export const usePostpartumControlTable = (
  patientUuid: string,
): { prenatalEncounters: ObsEncounter[]; error: Error | null; isValidating: boolean; mutate: () => void } => {
  const config = useConfig() as ConfigObject;
  const formName = config.formsList.postpartumControl;

  const tipoEncuentro = 'Control Postnatal';
  const attentionssUrl = useMemo(() => {
    return `${restBaseUrl}/encounter?patient=${patientUuid}&encounterType=${tipoEncuentro}`;
  }, [patientUuid]);

  const { data, error, isValidating, mutate } = useSWR<EncounterResponse>(
    patientUuid ? attentionssUrl : null,
    async (url) => {
      const response = await openmrsFetch(url);
      return response?.data;
    },
  );

  const encounterUuids = useMemo(() => {
    if (!data || !data.results) return [];
    return data.results.map((encounter: Encounter) => encounter.uuid);
  }, [data]);

  const { data: detailedEncounters, error: detailedError } = useSWRImmutable(
    encounterUuids.length > 0
      ? encounterUuids.map(
          (uuid) =>
            `${restBaseUrl}/encounter/${uuid}?v=custom:(encounterDatetime,form:(uuid,display),obs:(uuid,display))`,
        )
      : null,
    async (urls) => {
      const responses = await Promise.all(urls.map((url) => openmrsFetch(url)));
      return responses.map((res) => res?.data);
    },
  );

  // Filter prenatal encounters and sort by encounterDatetime
  const filteredPrenatalEncounters = useMemo(() => {
    if (!detailedEncounters) return [];

    return detailedEncounters
      .filter((encounter) => encounter?.form?.display === formName)
      .sort((a, b) => new Date(a.encounterDatetime).getTime() - new Date(b.encounterDatetime).getTime());
  }, [detailedEncounters, formName]);

  // Extract all observation UUIDs from all encounters
  const allObsUuids = useMemo(() => {
    if (!filteredPrenatalEncounters) return [];

    const uuids: string[] = [];
    filteredPrenatalEncounters.forEach((encounter) => {
      if (encounter.obs) {
        encounter.obs.forEach((obs) => {
          uuids.push(obs.uuid);
        });
      }
    });

    return uuids;
  }, [filteredPrenatalEncounters]);

  // Fetch group members for all observations
  const { data: obsDetails, error: obsError } = useSWRImmutable(
    allObsUuids.length > 0
      ? allObsUuids.map((uuid) => `${restBaseUrl}/obs/${uuid}?v=custom:(uuid,display,groupMembers:(uuid,display))`)
      : null,
    async (urls) => {
      const responses = await Promise.all(urls.map((url) => openmrsFetch(url)));
      return responses.map((res) => res?.data);
    },
  );

  // Combine encounters with detailed observations including group members
  const prenatalEncounters = useMemo(() => {
    if (!filteredPrenatalEncounters) return [];
    if (!obsDetails) return filteredPrenatalEncounters;

    // Create enhanced encounters with detailed observations
    return filteredPrenatalEncounters.map((encounter) => {
      // Create a deep copy of the encounter to avoid mutation issues
      const enhancedEncounter = {
        ...encounter,
        obs: [], // Initialize with empty array to rebuild with enhanced obs
      };

      // Replace each observation with its detailed version including group members
      if (encounter.obs && encounter.obs.length > 0) {
        enhancedEncounter.obs = encounter.obs.map((obs) => {
          // Find the detailed observation with group members
          const detailedObs = obsDetails.find((detail) => detail.uuid === obs.uuid);

          if (detailedObs) {
            // Return the detailed observation with group members
            return detailedObs;
          } else {
            // Return the original observation if no detailed version found
            return obs;
          }
        });
      }

      return enhancedEncounter;
    });
  }, [filteredPrenatalEncounters, obsDetails]);
  return {
    prenatalEncounters,
    error: error || detailedError || obsError,
    isValidating,
    mutate,
  };
};
