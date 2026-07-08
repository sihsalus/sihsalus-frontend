import { type FetchResponse, openmrsFetch, restBaseUrl, usePatient } from '@openmrs/esm-framework';
import { useCallback, useEffect, useMemo } from 'react';
import useSWR from 'swr';
import useSWRInfinite from 'swr/infinite';

import {
  type Concept,
  type ConceptMeta,
  type FHIRObservationResource,
  type FhirResponse,
  type ObsRecord,
} from '../../types';

import { extractMetaInformation, getConceptUuid, isLabConcept } from './helper';
import {
  assessValue,
  extractObservationInterpretation,
  extractObservationReferenceRanges,
} from '../loadPatientTestData/helpers';

export function useObservations() {
  const { patientUuid } = usePatient();
  const getUrl = useCallback(
    (pageIndex: number, prevPageData: FetchResponse<FhirResponse<FHIRObservationResource>>) => {
      if (prevPageData && !prevPageData?.data?.link.some(({ relation }) => relation === 'next')) {
        return null;
      }
      if (!patientUuid) {
        return null;
      }
      let url = '/ws/fhir2/R4/Observation';
      url += '?category=laboratory';
      url += `&patient=${patientUuid}`;
      url += `&_count=100`;
      if (pageIndex) {
        url += `&_getpagesoffset=${pageIndex * 10}`;
      }
      return url;
    },
    [patientUuid],
  );
  const { data, size, setSize, isLoading } = useSWRInfinite<
    FetchResponse<FhirResponse<FHIRObservationResource>>,
    Error
  >(getUrl, openmrsFetch, {
    revalidateIfStale: false,
    revalidateOnFocus: false,
  });

  useEffect(() => {
    // Infinitely fetching all the data
    if (data && data?.length === size && data?.[data.length - 1]?.data?.link?.some((x) => x.relation === 'next')) {
      setSize(size + 1);
    }
  }, [size, setSize, data]);

  const results = useMemo(() => {
    const observations: Array<FHIRObservationResource> = data
      ? []
          .concat(...data.map((resp) => resp.data.entry?.map((e) => e.resource) ?? []))
          .sort((obs1, obs2) => Date.parse(obs2.effectiveDateTime) - Date.parse(obs1.effectiveDateTime))
      : null;
    return {
      observations,
      isLoading,
      conceptUuids: observations ? [...new Set(observations.map((obs) => getConceptUuid(obs)))] : null,
    };
  }, [data, isLoading]);

  return results;
}

function useConcepts(conceptUuids: Array<string>) {
  const getUrl = useCallback(
    (index) => {
      if (conceptUuids && index < conceptUuids.length) {
        return `${restBaseUrl}/concept/${conceptUuids[index]}?v=full`;
      }
      return null;
    },
    [conceptUuids],
  );
  const { data, isLoading } = useSWRInfinite<FetchResponse<Concept>>(getUrl, openmrsFetch, {
    initialSize: conceptUuids?.length ?? 1,
    revalidateIfStale: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
  });

  const results = useMemo(() => {
    const concepts: Array<Concept> = data ? [].concat(data?.map((resp) => resp.data)) : null;
    return {
      concepts: concepts ? concepts.filter(isLabConcept) : null,
      // If there are no observations, hence no concept UUIDS, then it should return isLoading as false
      isLoading: conceptUuids?.length === 0 ? false : isLoading,
    };
  }, [data, conceptUuids, isLoading]);

  return results;
}

export default function usePanelData() {
  const { observations: fhirObservations, conceptUuids, isLoading: isLoadingObservations } = useObservations();
  const { concepts } = useConcepts(conceptUuids);
  const { patientUuid } = usePatient();

  const { data: usersData } = useSWR<FetchResponse<{ results: Array<any> }>>(
    `${restBaseUrl}/user?v=custom:(username,systemId,person:(display))&limit=100`,
    openmrsFetch,
  );

  const { data: restObsData } = useSWR<FetchResponse<{ results: Array<any> }>>(
    patientUuid ? `${restBaseUrl}/obs?patient=${patientUuid}&v=custom:(uuid,auditInfo:(creator:(display)))&limit=200` : null,
    openmrsFetch,
  );

  const conceptData: Record<string, ConceptMeta> = useMemo(
    () =>
      concepts
        ? Object.fromEntries(
            concepts?.map((concept) => [
              concept.uuid,
              {
                display: concept.display,
                ...extractMetaInformation(concept),
              },
            ]),
          )
        : {},
    [concepts],
  );

  const userMap = useMemo(() => {
    const map = new Map<string, string>();
    if (usersData?.data?.results) {
      usersData.data.results.forEach((user: any) => {
        const realName = user.person?.display?.replace(/\s+/g, ' ').trim() || '';
        if (realName) {
          if (user.username) {
            map.set(user.username.toLowerCase(), realName);
          }
          if (user.systemId) {
            map.set(user.systemId.toLowerCase(), realName);
          }
        }
      });
    }
    return map;
  }, [usersData]);

  const creatorMap = useMemo(() => {
    const map = new Map<string, string>();
    if (restObsData?.data?.results) {
      restObsData.data.results.forEach((obs: any) => {
        if (obs.uuid && obs.auditInfo?.creator?.display) {
          const creatorDisplay = obs.auditInfo.creator.display;
          const realName = userMap.get(creatorDisplay.toLowerCase()) || creatorDisplay;
          map.set(obs.uuid, realName);
        }
      });
    }
    return map;
  }, [restObsData, userMap]);

  const observations: Array<ObsRecord> = useMemo(
    () =>
      fhirObservations?.map((observation) => {
        const conceptUuid = getConceptUuid(observation);
        const value = getObservationValue(observation);

        // is a singe test
        const conceptMeta = conceptData[conceptUuid];

        // Extraer rangos a nivel de observación
        const obsRanges = extractObservationReferenceRanges(observation as any);
        const hasObsRanges =
          obsRanges &&
          (obsRanges.lowNormal !== undefined || obsRanges.hiNormal !== undefined || obsRanges.range !== undefined);

        const meta = hasObsRanges
          ? {
              ...conceptMeta,
              ...obsRanges,
              range:
                obsRanges.range ??
                (obsRanges.lowNormal !== undefined && obsRanges.hiNormal !== undefined
                  ? `${obsRanges.lowNormal} – ${obsRanges.hiNormal}`
                  : conceptMeta?.range),
            }
          : (conceptMeta as any);

        // Determinar interpretación prefiriendo la del servidor FHIR
        let interpretation = extractObservationInterpretation(observation as any);
        if (!interpretation && meta) {
          interpretation = assessValue(meta as any)(value);
        }

        const name = observation?.code.coding[0].display;
        let performerName = observation.performer?.[0]?.display;
        if (!performerName && creatorMap.has(observation.id)) {
          performerName = creatorMap.get(observation.id);
        }
        const performer = performerName
          ? [{ reference: '', display: performerName }]
          : observation.performer;
        return {
          ...observation,
          conceptUuid,
          value,
          meta,
          interpretation: interpretation as any,
          name,
          performer,
          relatedObs: [],
        };
      }),
    [fhirObservations, conceptData, creatorMap],
  );

  const groupedObservations: Record<string, Array<ObsRecord>> = useMemo(() => {
    const groups = {};
    if (observations) {
      observations.forEach((obs) => {
        if (groups[getConceptUuid(obs)]) {
          groups[getConceptUuid(obs)].push(obs);
        } else {
          groups[getConceptUuid(obs)] = [obs];
        }
      });
    }
    return groups;
  }, [observations]);

  const individualObservations = useMemo(
    () => (observations ? observations.filter((obs) => !obs.hasMember) : []),
    [observations],
  );

  const setObservations: Array<ObsRecord> = useMemo(
    () =>
      observations
        ? observations
            .filter((obs) => !!obs.hasMember)
            .map((obs) => {
              const relatedObs = [];
              obs.hasMember.forEach((memb) => {
                const membUuid = memb.reference.split('/')[1];
                const memberObservationIndex = individualObservations.findIndex((obs) => obs.id === membUuid);
                if (memberObservationIndex > -1) {
                  relatedObs.push(individualObservations[memberObservationIndex]);
                  individualObservations.splice(memberObservationIndex, 1);
                }
              });
              return {
                ...obs,
                relatedObs,
              };
            })
        : [],
    [individualObservations, observations],
  );

  const panels = useMemo(() => {
    const allPanels = [...individualObservations, ...setObservations].sort(
      (obs1, obs2) => Date.parse(obs2.effectiveDateTime) - Date.parse(obs1.effectiveDateTime),
    );
    const usedConcepts: Set<string> = new Set();
    const latestPanels: Array<ObsRecord> = [];
    allPanels.forEach((panel) => {
      if (usedConcepts.has(panel.conceptUuid)) return;
      usedConcepts.add(panel.conceptUuid);
      latestPanels.push(panel);
    });
    return latestPanels;
  }, [individualObservations, setObservations]);

  const panelsData = useMemo(
    () => ({
      panels,
      isLoading: isLoadingObservations,
      groupedObservations,
      conceptData,
    }),
    [panels, isLoadingObservations, groupedObservations, conceptData],
  );

  return panelsData;
}

const getObservationValue = (observation: FHIRObservationResource) => {
  if (observation?.valueQuantity) {
    return `${observation?.valueQuantity?.value}`;
  } else if (observation?.valueCodeableConcept) {
    return observation.valueCodeableConcept.text;
  }
  return observation.valueString;
};
