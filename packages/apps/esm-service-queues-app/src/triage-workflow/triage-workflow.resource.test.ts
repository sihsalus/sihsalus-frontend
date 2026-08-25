import { type FetchResponse, getConfig, openmrsFetch } from '@openmrs/esm-framework';
import {
  copyFinanciadorToVisit,
  fetchPersonInsurance,
  fetchVisitInsurance,
  FINANCIADOR_VISIT_ATTRIBUTE_TYPE_UUID,
  type PersonInsurance,
  INSURANCE_NUMBER_VISIT_ATTRIBUTE_TYPE_UUID,
  SIS_ACCREDITATION_ACTIVE_CONCEPT_UUID,
  SIS_ACCREDITATION_INACTIVE_CONCEPT_UUID,
  SIS_ACCREDITATION_CHECKED_AT_VISIT_ATTRIBUTE_TYPE_UUID,
  SIS_ACCREDITATION_STATUS_VISIT_ATTRIBUTE_TYPE_UUID,
  SIS_CONCEPT_UUID,
} from '@openmrs/esm-patient-common-lib';

import { transitionQueueEntry } from '../modals/queue-entry-actions.resource';
import { type QueueEntry } from '../types';
import {
  type AppointmentTriageConfig,
  getLinkedAppointmentUuid,
  getPersonSisState,
  getSisState,
  getTriageState,
  revalidateCurrentSisState,
  refreshVisitSisStateFromPerson,
  selectAppointmentForQueueEntry,
  transitionTriagedPatient,
} from './triage-workflow.resource';

vi.mock('@openmrs/esm-patient-common-lib', async () => ({
  ...(await vi.importActual('@openmrs/esm-patient-common-lib')),
  copyFinanciadorToVisit: vi.fn(),
  fetchPersonInsurance: vi.fn(),
  fetchVisitInsurance: vi.fn(),
}));

vi.mock('../modals/queue-entry-actions.resource', () => ({
  transitionQueueEntry: vi.fn(),
}));

const appointmentAttributeTypeUuid = 'appointment-attribute-type-uuid';
const triageEncounterTypeUuid = 'triage-encounter-type-uuid';
const triageQueueUuid = 'triage-queue-uuid';
const destinationQueueUuid = 'destination-queue-uuid';
const finishedServiceStatusUuid = 'finished-service-status-uuid';

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

function makeQueueEntry({
  triaged = false,
  sis = true,
  includeNumber = true,
  includeCheckedAt = true,
} = {}): QueueEntry {
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
              ...(includeNumber
                ? [{ attributeType: { uuid: INSURANCE_NUMBER_VISIT_ATTRIBUTE_TYPE_UUID }, value: 'SIS-123' }]
                : []),
              {
                attributeType: { uuid: SIS_ACCREDITATION_STATUS_VISIT_ATTRIBUTE_TYPE_UUID },
                value: '9b3df0a1-0c58-4f55-9868-9c38f1db2051',
              },
              ...(includeCheckedAt
                ? [
                    {
                      attributeType: { uuid: SIS_ACCREDITATION_CHECKED_AT_VISIT_ATTRIBUTE_TYPE_UUID },
                      value: '2026-08-11T14:30:00.000-05:00',
                    },
                  ]
                : []),
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
    vi.mocked(fetchPersonInsurance).mockResolvedValue({
      insuranceTypeUuid: SIS_CONCEPT_UUID,
      insuranceCode: 'SIS-123',
      accreditationStatusUuid: SIS_ACCREDITATION_ACTIVE_CONCEPT_UUID,
      accreditationCheckedAt: '2026-08-13T10:00:00.000-05:00',
    });
    vi.mocked(getConfig).mockImplementation(async (moduleName) => {
      if (moduleName === '@sihsalus/esm-appointments-app') {
        return appointmentConfig;
      }
      return { concepts: { finishedServiceStatusConceptUuid: finishedServiceStatusUuid } };
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

  it('keeps triage pending for a legacy entry in the triage queue without an appointment attribute', () => {
    const entry = makeQueueEntry();
    entry.visit.attributes = entry.visit.attributes.filter(
      (attribute) => attribute.attributeType?.uuid !== appointmentAttributeTypeUuid,
    );

    expect(getTriageState(entry, appointmentConfig)).toBe('pending');
  });

  it('recovers the appointment hour using the same patient, date and UPSS', () => {
    const entry = {
      ...makeQueueEntry(),
      startedAt: '2026-08-13T10:05:00.000-05:00',
      visit: {
        ...makeQueueEntry().visit,
        startDatetime: '2026-08-13T10:05:00.000-05:00',
        location: { uuid: 'appointment-location-uuid' },
      },
    } as QueueEntry;
    const appointments = [
      {
        uuid: 'other-patient',
        patient: { uuid: 'other-patient-uuid' },
        location: { uuid: 'appointment-location-uuid' },
        startDateTime: '2026-08-13T10:00:00.000-05:00',
        status: 'CheckedIn',
      },
      {
        uuid: 'wrong-upss',
        patient: { uuid: 'patient-uuid' },
        location: { uuid: 'other-location-uuid' },
        startDateTime: '2026-08-13T10:00:00.000-05:00',
        status: 'CheckedIn',
      },
      {
        uuid: 'scheduled-nearby',
        patient: { uuid: 'patient-uuid' },
        location: { uuid: 'appointment-location-uuid' },
        startDateTime: '2026-08-13T10:10:00.000-05:00',
        status: 'Scheduled',
      },
      {
        uuid: 'checked-in-appointment',
        patient: { uuid: 'patient-uuid' },
        location: { uuid: 'appointment-location-uuid' },
        startDateTime: Date.parse('2026-08-13T11:00:00.000-05:00'),
        status: 'CheckedIn',
      },
    ];

    expect(selectAppointmentForQueueEntry(entry, appointments)?.uuid).toBe('checked-in-appointment');
  });

  it('does not expose an active SIS state when the visit bundle is incomplete', () => {
    expect(getSisState(makeQueueEntry({ includeNumber: false }))).toBe('missing');
    expect(getSisState(makeQueueEntry({ includeCheckedAt: false }))).toBe('missing');
  });

  it('derives the queue status from the patient current affiliation', () => {
    const insurance: PersonInsurance = {
      insuranceTypeUuid: SIS_CONCEPT_UUID,
      insuranceCode: 'SIS-123',
      accreditationStatusUuid: SIS_ACCREDITATION_INACTIVE_CONCEPT_UUID,
      accreditationCheckedAt: '2026-08-13T10:00:00.000-05:00',
    };

    expect(getPersonSisState(insurance)).toBe('inactive');
  });

  it('persists current patient coverage into the visit and verifies the stored result', async () => {
    vi.mocked(copyFinanciadorToVisit).mockResolvedValue({ ok: true, skipped: false, created: 0, updated: 1 });
    vi.mocked(fetchVisitInsurance).mockResolvedValue({
      financiadorUuid: SIS_CONCEPT_UUID,
      insuranceNumber: 'SIS-123',
      accreditationStatusUuid: SIS_ACCREDITATION_ACTIVE_CONCEPT_UUID,
      accreditationCheckedAt: '2026-08-13T10:00:00.000-05:00',
    });

    await expect(refreshVisitSisStateFromPerson(makeQueueEntry())).resolves.toBe('active');
    expect(copyFinanciadorToVisit).toHaveBeenCalledWith({
      patientUuid: 'patient-uuid',
      visitUuid: 'visit-uuid',
      onlyFillMissing: false,
    });
    expect(fetchVisitInsurance).toHaveBeenCalledWith('visit-uuid');
  });

  it('validates current patient coverage without mutating the visit when the user lacks visit-edit access', async () => {
    vi.mocked(fetchPersonInsurance).mockResolvedValue({
      insuranceTypeUuid: SIS_CONCEPT_UUID,
      insuranceCode: 'SIS-123',
      accreditationStatusUuid: SIS_ACCREDITATION_INACTIVE_CONCEPT_UUID,
      accreditationCheckedAt: '2026-08-13T10:00:00.000-05:00',
    });

    await expect(revalidateCurrentSisState(makeQueueEntry(), false)).resolves.toBe('inactive');
    expect(copyFinanciadorToVisit).not.toHaveBeenCalled();
    expect(fetchVisitInsurance).not.toHaveBeenCalled();
  });

  it('transitions a triaged patient to the configured clinical queue with the service finished status', async () => {
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
      newStatus: finishedServiceStatusUuid,
    });
  });
});
