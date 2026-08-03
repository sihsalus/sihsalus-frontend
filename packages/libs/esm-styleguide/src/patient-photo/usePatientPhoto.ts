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
  comment?: string;
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

// SIHSALUS historically stored profile photos with the generic image concept
// used by the Attachments module. Keep a narrowly filtered fallback so those
// photos remain visible without allowing ordinary clinical images to become
// the patient's avatar.
const legacyAttachmentImageConceptUuid = '7cac8397-53cd-4f00-a6fe-028e8d743f8e';
const legacyPatientPhotoComment = 'patient photo';
const legacyPatientPhotoFilename = 'patient-photo.png';

function getObsDatetime(obs: PhotoObs) {
  const timestamp = new Date(obs.obsDatetime).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function getLatestPhoto(observations: Array<PhotoObs>, predicate: (obs: PhotoObs) => boolean = () => true) {
  return observations.filter(predicate).reduce<PhotoObs | undefined>((latest, candidate) => {
    if (!latest) {
      return candidate;
    }

    return getObsDatetime(candidate) > getObsDatetime(latest) ? candidate : latest;
  }, undefined);
}

function isLegacyPatientPhoto(obs: PhotoObs) {
  const comment = obs.comment?.trim().toLowerCase();
  const displays = [obs.display, obs.value?.display]
    .filter((display): display is string => Boolean(display))
    .map((display) => display.trim().toLowerCase());
  const hasPatientPhotoFilename = displays.some(
    (display) =>
      display === legacyPatientPhotoFilename ||
      display.endsWith(`/${legacyPatientPhotoFilename}`) ||
      display.endsWith(`|${legacyPatientPhotoFilename}`),
  );

  return comment === legacyPatientPhotoComment || hasPatientPhotoFilename;
}

export function usePatientPhoto(patientUuid: string): UsePatientPhotoResult {
  const { patientPhotoConceptUuid } = useConfig<StyleguideConfigObject>({
    externalModuleName: '@openmrs/esm-styleguide',
  });

  const url =
    patientUuid && patientPhotoConceptUuid
      ? `${restBaseUrl}/obs?patient=${patientUuid}&concept=${patientPhotoConceptUuid}&v=full`
      : null;

  const primary = useSWR<{ data: ObsFetchResponse }, Error>(url, openmrsFetch);
  const primaryItem = getLatestPhoto(
    primary.data?.data?.results ?? [],
    patientPhotoConceptUuid === legacyAttachmentImageConceptUuid ? isLegacyPatientPhoto : undefined,
  );
  const shouldLoadLegacyPhoto = Boolean(
    patientUuid &&
      patientPhotoConceptUuid &&
      patientPhotoConceptUuid !== legacyAttachmentImageConceptUuid &&
      !primary.isLoading &&
      !primaryItem,
  );
  const legacyUrl = shouldLoadLegacyPhoto
    ? `${restBaseUrl}/obs?patient=${patientUuid}&concept=${legacyAttachmentImageConceptUuid}&v=full`
    : null;
  const legacy = useSWR<{ data: ObsFetchResponse }, Error>(legacyUrl, openmrsFetch);
  const legacyItem = getLatestPhoto(legacy.data?.data?.results ?? [], isLegacyPatientPhoto);
  const item = primaryItem ?? legacyItem;

  const isLoading = primary.isLoading || (Boolean(legacyUrl) && legacy.isLoading);

  return {
    data: item
      ? {
          dateTime: item?.obsDatetime,
          imageSrc: item?.value?.links?.uri,
        }
      : null,
    error: legacy.error ?? primary.error,
    isLoading,
  };
}
