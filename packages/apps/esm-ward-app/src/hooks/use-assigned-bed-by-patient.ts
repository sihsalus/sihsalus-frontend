import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import useSWR from 'swr';
import { type BedDetail } from '../types';

export function useAssignedBedByPatient(patientUuid: string) {
  const url = `${restBaseUrl}/beds?patientUuid=${patientUuid}`;

  return useSWR<{ data: { results: Array<BedDetail> } }, Error>(url, openmrsFetch);
}
