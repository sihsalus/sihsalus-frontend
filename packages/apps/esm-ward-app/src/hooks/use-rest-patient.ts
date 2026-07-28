import { type FetchResponse, openmrsFetch, type Patient, restBaseUrl } from '@openmrs/esm-framework';
import useSWRImmutable from 'swr/immutable';

// prettier-ignore
const defaultRep =
  'custom:(' +
  'uuid,identifiers,voided,' +
  'person:(' +
  'uuid,display,gender,age,birthdate,birthtime,preferredName,preferredAddress,dead,deathDate)' +
  ')';

export default function useRestPatient(patientUuid: string, rep = defaultRep) {
  const { data, ...rest } = useSWRImmutable<FetchResponse<Patient>>(
    patientUuid ? `${restBaseUrl}/patient/${patientUuid}?v=${rep}` : null,
    openmrsFetch,
  );
  return {
    patient: data?.data,
    ...rest,
  };
}
