/** @module @category UI */

import { openmrsFetch, restBaseUrl } from '@openmrs/esm-api';
import { useConfig } from '@openmrs/esm-react-utils';
import useSWR from 'swr';
import { type StyleguideConfigObject } from '../config-schema';

export interface UsePatientPhotoResult {
  data: { dateTime: string; imageSrc: string } | null;
  error?: Error;
  isLoading: boolean;
}

interface ObsFetchResponse {
  results: Array<PhotoObs>;
}

interface PhotoObs {
  display: string;
  obsDatetime: string;
  uuid: string;
  value: {
    display: string;
    links: {
      rel: string;
      uri: string;
    };
  };
}

function getObsDatetime(obs: PhotoObs) {
  const timestamp = new Date(obs.obsDatetime).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

export function usePatientPhoto(patientUuid: string): UsePatientPhotoResult {
  const { patientPhotoConceptUuid } = useConfig<StyleguideConfigObject>({
    externalModuleName: '@openmrs/esm-styleguide',
  });

  const url = patientPhotoConceptUuid
    ? `${restBaseUrl}/obs?patient=${patientUuid}&concept=${patientPhotoConceptUuid}&v=full`
    : null;

  const { data, error, isLoading } = useSWR<{ data: ObsFetchResponse }, Error>(patientUuid ? url : null, openmrsFetch);

  const item = data?.data?.results.reduce<PhotoObs | undefined>((latest, candidate) => {
    if (!latest) {
      return candidate;
    }

    return getObsDatetime(candidate) > getObsDatetime(latest) ? candidate : latest;
  }, undefined);

  return {
    data: item
      ? {
          dateTime: item?.obsDatetime,
          imageSrc: item?.value?.links?.uri,
        }
      : null,
    error: error,
    isLoading,
  };
}
