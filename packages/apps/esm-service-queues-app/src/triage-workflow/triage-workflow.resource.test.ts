import { type FetchResponse, getConfig, openmrsFetch } from '@openmrs/esm-framework';
import {
  FINANCIADOR_VISIT_ATTRIBUTE_TYPE_UUID,
  SIS_ACCREDITATION_STATUS_VISIT_ATTRIBUTE_TYPE_UUID,
  SIS_CONCEPT_UUID,
} from '@openmrs/esm-patient-common-lib';

import { transitionQueueEntry } from '../modals/queue-entry-actions.resource';
import { type QueueEntry } from '../types';
import {
  type AppointmentTriageConfig,
  getLinkedAppointmentUuid,
  getSisState,
  getTriageState,
  transitionTriagedPatient,
} from './triage-workflow.resource';

vi.mock('../modals/queue-entry-actions.resource', () => ({
  transitionQueueEntry: vi.fn(),
}));

const appointmentAttributeTypeUuid = 'appointment-attribute-type-uuid';
const triageEncounterTypeUuid = 'triage-encounter-type-uuid';
const triageQueueUuid = 'triage-queue-uuid';
const destinationQueueUuid = 'destination-queue-uuid';
const waitingStatusUuid = 'waiting-status-uuid';

function mockFetchResponse<T>(data: T): FetchResponse<T> {
  return { data } as unknown as FetchResponse<T>;
}

const appointmentConfig: AppointmentTriageConfig = {
  appointmentVisitAttributeTypeUuid: appointmentAttributeTypeUuid,
  triageRouting: {
    enabled: true,
    encounterTypeUuid: triageEncounterTypeUuid,
    queueLocationUuid: 'triage-location-uuid',
    queueUuid: triageQueueUuid,
  },
  appointmentArrivalRules: [
    {
      appointmentLocationUuid: 'appointment-location-uuid',
      appointmentServiceUuid: 'appointment-service-uuid',
      queueUuid: destinationQueueUuid,
      requiresTriage: true,
    },
  ],
};

function makeQueueEntry({ triaged = false, sis = true } = {}): QueueEntry {
  return {
    uuid: 'queue-entry-uuid',
    patient: { uuid: 'patient-uuid' },
    priority: { uuid: 'priority-uuid' },
    queue: { uuid: triageQueueUuid },
    visit: {
      uuid: 'visit-uuid',
      attributes: [
        { attributeType: { uuid: appointmentAttributeTypeUuid }, value: 'appointment-uuid' },
        ...(sis
          ? [
              { attributeType: { uuid: FINANCIADOR_VISIT_ATTRIBUTE_TYPE_UUID }, value: SIS_CONCEPT_UUID },
              {
                attributeType: { uuid: SIS_ACCREDITATION_STATUS_VISIT_ATTRIBUTE_TYPE_UUID },
                value: '9b3df0a1-0c58-4f55-9868-9c38f1db2051',
              },
            ]
          : []),
      ],
      encounters: triaged
        ? [{ uuid: 'triage-encounter-uuid', encounterType: { uuid: triageEncounterTypeUuid }, voided: false }]
        : [],
    },
  } as unknown as QueueEntry;
}

describe('outpatient triage workflow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getConfig).mockImplementation(async (moduleName) => {
      if (moduleName === '@sihsalus/esm-appointments-app') {
        return appointmentConfig;
      }
      return { concepts: { defaultStatusConceptUuid: waitingStatusUuid } };
    });
  });

  it('derives the appointment, SIS, and triage states from the active visit', () => {
    const pendingEntry = makeQueueEntry();
    const completedEntry = makeQueueEntry({ triaged: true });

    expect(getLinkedAppointmentUuid(pendingEntry, appointmentConfig)).toBe('appointment-uuid');
    expect(getSisState(pendingEntry)).toBe('active');
    expect(getSisState(makeQueueEntry({ sis: false }))).toBe('notApplicable');
    expect(getTriageState(pendingEntry, appointmentConfig)).toBe('pending');
    expect(getTriageState(completedEntry, appointmentConfig)).toBe('completed');
  });

  it('transitions a triaged patient to the exact queue configured for the appointment', async () => {
    vi.mocked(openmrsFetch).mockResolvedValue(
      mockFetchResponse({
        uuid: 'appointment-uuid',
        location: { uuid: 'appointment-location-uuid' },
        service: { uuid: 'appointment-service-uuid' },
      }),
    );
    vi.mocked(transitionQueueEntry).mockResolvedValue(mockFetchResponse(makeQueueEntry({ triaged: true })));

    await transitionTriagedPatient(makeQueueEntry({ triaged: true }));

    expect(transitionQueueEntry).toHaveBeenCalledWith({
      queueEntryToTransition: 'queue-entry-uuid',
      newQueue: destinationQueueUuid,
      newPriority: 'priority-uuid',
      newStatus: waitingStatusUuid,
    });
  });
});
