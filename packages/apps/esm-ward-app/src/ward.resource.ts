import { type OpenmrsResource, openmrsFetch, type Patient, restBaseUrl, useSession } from '@openmrs/esm-framework';
import useEmrConfiguration from './hooks/useEmrConfiguration';
import useWardLocation from './hooks/useWardLocation';
import type { DispositionType, Encounter, ObsPayload } from './types';

export function useCreateEncounter() {
  const { location } = useWardLocation();
  const { currentProvider } = useSession();
  const { emrConfiguration, isLoadingEmrConfiguration, errorFetchingEmrConfiguration } = useEmrConfiguration();

  const createEncounter = (
    patient: Patient,
    encounterType: OpenmrsResource,
    visitUuid: string,
    obs: ObsPayload[] = [],
  ) => {
    if (!location?.uuid) {
      return Promise.reject(new Error('An operational ward location is required'));
    }

    const encounterPayload = {
      patient: patient.uuid,
      encounterType,
      location: location.uuid,
      encounterProviders: [
        {
          provider: currentProvider?.uuid,
          encounterRole: emrConfiguration?.clinicianEncounterRole?.uuid,
        },
      ],
      obs,
      visit: visitUuid,
    };

    return openmrsFetch<Encounter>(`${restBaseUrl}/encounter`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: encounterPayload,
    });
  };

  return { createEncounter, emrConfiguration, isLoadingEmrConfiguration, errorFetchingEmrConfiguration };
}

export function deleteEncounter(encounterUuid: string) {
  return openmrsFetch(`${restBaseUrl}/encounter/${encounterUuid}`, {
    method: 'DELETE',
  });
}

export function useAdmitPatient() {
  const { createEncounter, emrConfiguration, isLoadingEmrConfiguration, errorFetchingEmrConfiguration } =
    useCreateEncounter();

  const admitPatient = (patient: Patient, dispositionType: DispositionType, visitUuid: string) => {
    const encounterType =
      dispositionType === 'ADMIT'
        ? emrConfiguration.admissionEncounterType
        : dispositionType === 'TRANSFER'
          ? emrConfiguration.transferWithinHospitalEncounterType
          : null;
    return createEncounter(patient, encounterType, visitUuid);
  };

  return { admitPatient, isLoadingEmrConfiguration, errorFetchingEmrConfiguration };
}

export function assignPatientToBed(bedUuid: number, patientUuid: string, encounterUuid: string) {
  return openmrsFetch(`${restBaseUrl}/beds/${bedUuid}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: {
      patientUuid,
      encounterUuid,
    },
  });
}

export function removePatientFromBed(bedId: number, patientUuid: string) {
  return openmrsFetch(`${restBaseUrl}/beds/${bedId}?patientUuid=${patientUuid}`, {
    method: 'DELETE',
  });
}

export function getAssignedBedByPatient(patientUuid: string) {
  return openmrsFetch<{ results: Array<{ bedId: number }> }>(`${restBaseUrl}/beds?patientUuid=${patientUuid}`);
}
