import { mockLocationInpatientWard } from 'test-utils/mocks/locations.mock';
import { mockPatientAlice } from 'test-utils/mocks/patient.mock';
import { mockVisitAlice } from 'test-utils/mocks/visits.mock';
import { type InpatientAdmission } from '../../src/types';
import { mockEncounterAlice } from './encounter-ward.mock';

export const mockInpatientAdmissionAlice: InpatientAdmission = {
  patient: mockPatientAlice,
  visit: mockVisitAlice,
  currentInpatientRequest: null,
  firstAdmissionOrTransferEncounter: mockEncounterAlice,
  encounterAssigningToCurrentInpatientLocation: mockEncounterAlice,
  currentInpatientLocation: mockLocationInpatientWard,
};
