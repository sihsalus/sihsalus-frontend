import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import { assertFreshPatientIsAlive } from '@openmrs/esm-patient-common-lib';

/** Guard the final queue-screen write, independently of any preceding queue transition. */
export async function serveQueueEntry(
  patientUuid: string,
  servicePointName: string,
  ticketNumber: string,
  status: string,
) {
  const abortController = new AbortController();

  await assertFreshPatientIsAlive(patientUuid);
  return openmrsFetch(`${restBaseUrl}/queueutil/assignticket`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    signal: abortController.signal,
    body: {
      servicePointName,
      ticketNumber,
      status,
    },
  });
}
