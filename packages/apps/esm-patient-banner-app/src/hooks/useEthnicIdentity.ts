import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import useSWR from 'swr';
import { usePatientAttributes } from './usePatientAttributes';

interface Obs {
  uuid: string;
  obsDatetime: string;
  value: string | { display?: string };
}

function getDisplayValue(value: unknown) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  if (typeof value === 'object') {
    const displayableValue = value as { display?: string; name?: string; value?: string | number };
    return String(displayableValue.display ?? displayableValue.name ?? displayableValue.value ?? '') || null;
  }

  return String(value);
}

export function useEthnicIdentity(patientUuid: string, conceptUuid: string, attributeTypeUuid?: string) {
  const {
    attributes,
    error: attributeError,
    isLoading: isLoadingAttributes,
  } = usePatientAttributes(patientUuid && attributeTypeUuid ? patientUuid : null);
  const url =
    patientUuid && conceptUuid
      ? `${restBaseUrl}/obs?patient=${patientUuid}&concept=${conceptUuid}&v=custom:(uuid,obsDatetime,value)&limit=1`
      : null;

  const { data, error, isLoading, mutate } = useSWR<{ data: { results: Obs[] } }, Error>(url, openmrsFetch);
  const ethnicityAttribute = attributes.find(({ attributeType }) => attributeType?.uuid === attributeTypeUuid);
  const latestObs = data?.data?.results?.[0];
  const attributeValue = getDisplayValue(ethnicityAttribute?.value);
  const obsValue = latestObs ? getDisplayValue(latestObs.value) : null;

  return {
    currentValue: attributeValue ?? obsValue,
    error: attributeError ?? error,
    isLoading: isLoadingAttributes || isLoading,
    mutate,
  };
}
