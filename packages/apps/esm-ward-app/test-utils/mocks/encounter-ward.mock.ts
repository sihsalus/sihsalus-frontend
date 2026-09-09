import { mockPatientAlice } from 'test-utils/mocks/patient.mock';
import { mockLocationSurgery } from 'test-utils/mocks/queue-entry.mock';
import { mockVisitAlice } from 'test-utils/mocks/visits.mock';
import { type Encounter } from '../../src/types';

export const mockEncounterAlice: Encounter = {
  uuid: 'asdf',
  encounterDatetime: '2024-06-27T19:40:16.000+0000',
  patient: mockPatientAlice,
  location: mockLocationSurgery,
  encounterType: {
    uuid: 'asdf',
    description: 'admission',
  },
  obs: [],
  visit: mockVisitAlice,
};
