import { type FetchResponse, openmrsFetch, restBaseUrl, toOmrsIsoString } from '@openmrs/esm-framework';
import {
  drainActiveQueueEntriesForPatient,
  drainActiveQueueEntriesForVisit,
  fetchFreshPatientVitalStatus,
  getQueueEntriesForVisit,
} from '@openmrs/esm-patient-common-lib';

import { markPatientDeceased } from '../data.resource';
import { reconcileDeceasedPatientWorkflow } from './deceased-patient-workflow.resource';

vi.mock('../data.resource', async () => ({
  markPatientDeceased: vi.fn(),
}));

vi.mock('@openmrs/esm-patient-common-lib', async () => ({
  ...(await vi.importActual('@openmrs/esm-patient-common-lib')),
  drainActiveQueueEntriesForPatient: vi.fn(),
  drainActiveQueueEntriesForVisit: vi.fn(),
  fetchFreshPatientVitalStatus: vi.fn(),
  getQueueEntriesForVisit: vi.fn(),
}));

const mockOpenmrsFetch = vi.mocked(openmrsFetch);
const mockMarkPatientDeceased = vi.mocked(markPatientDeceased);
const mockDrainActiveQueueEntriesForPatient = vi.mocked(drainActiveQueueEntriesForPatient);
const mockDrainActiveQueueEntriesForVisit = vi.mocked(drainActiveQueueEntriesForVisit);
const mockFetchFreshPatientVitalStatus = vi.mocked(fetchFreshPatientVitalStatus);
const mockGetQueueEntriesForVisit = vi.mocked(getQueueEntriesForVisit);

function response<T>(data: T, date = 'Wed, 12 Aug 2026 16:19:24 GMT') {
  return { data, headers: new Headers({ Date: date }) } as FetchResponse<T>;
}

interface MockAppointmentState {
  status: string;
  uuid: string;
  withoutDates?: boolean;
}

interface MockVisitState {
  encounters?: Array<{ encounterDatetime?: string | null }>;
  startDatetime?: string | null;
  stopDatetime?: string | null;
  uuid: string;
}

function handleVisitRequest(
  visits: Array<MockVisitState>,
  url: string | URL,
  init?: Parameters<typeof openmrsFetch>[1],
  pageSize = 100,
): FetchResponse<unknown> | undefined {
  const requestUrl = String(url);
  if (requestUrl.includes('/visit?')) {
    return response({ results: visits.filter(({ stopDatetime }) => !stopDatetime).slice(0, pageSize) });
  }

  const visitUuid = requestUrl.match(/\/visit\/([^?]+)/)?.[1];
  if (visitUuid) {
    return response(visits.find(({ uuid }) => uuid === decodeURIComponent(visitUuid)) ?? {});
  }

  if (requestUrl.endsWith('/clinicalvisitclosure')) {
    const body = init?.body as { stopDatetime: string; visitUuid: string };
    const visit = visits.find(({ uuid }) => uuid === body.visitUuid);
    if (visit) {
      visit.stopDatetime = body.stopDatetime;
    }
    return response({});
  }
}

function handleAppointmentRequest(
  appointments: Array<MockAppointmentState>,
  url: string | URL,
  init?: Parameters<typeof openmrsFetch>[1],
  pageSize = 50,
): FetchResponse<unknown> | undefined {
  const requestUrl = String(url);

  if (requestUrl.endsWith('/appointments/search') || requestUrl.endsWith('/appointment/search')) {
    const body = init?.body as { status?: string; withoutDates?: boolean };
    const withoutDates = requestUrl.endsWith('/appointment/search');
    const matches = appointments
      .filter(
        (appointment) =>
          appointment.status === body.status && Boolean(appointment.withoutDates) === withoutDates,
      )
      .slice(0, pageSize)
      .map(({ status, uuid }) => ({ status, uuid }));
    return response(matches);
  }

  const appointmentUuid = requestUrl.match(/\/appointment\?uuid=([^&]+)/)?.[1];
  if (appointmentUuid) {
    const appointment = appointments.find(({ uuid }) => uuid === decodeURIComponent(appointmentUuid));
    return response(appointment ? { status: appointment.status, uuid: appointment.uuid } : {});
  }

  const transitionUuid = requestUrl.match(/\/appointments\/([^/]+)\/status-change$/)?.[1];
  if (transitionUuid) {
    const appointment = appointments.find(({ uuid }) => uuid === decodeURIComponent(transitionUuid));
    const targetStatus = (init?.body as { toStatus: string }).toStatus;
    if (appointment) {
      appointment.status = targetStatus;
    }
    return response({ status: targetStatus });
  }
}

describe('reconcileDeceasedPatientWorkflow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchFreshPatientVitalStatus.mockReset();
    mockMarkPatientDeceased.mockResolvedValue({} as Awaited<ReturnType<typeof markPatientDeceased>>);
    mockDrainActiveQueueEntriesForPatient.mockResolvedValue(0);
    mockDrainActiveQueueEntriesForVisit.mockResolvedValue(0);
    mockFetchFreshPatientVitalStatus
      .mockResolvedValueOnce({ dead: false, deathDate: null, isDeceased: false })
      .mockResolvedValue({ dead: true, deathDate: '2026-08-12T15:41:28.000Z', isDeceased: true });
    mockGetQueueEntriesForVisit.mockResolvedValue(response({ results: [] }));
    vi.mocked(toOmrsIsoString).mockImplementation((value) => new Date(value).toISOString());
  });

  it("uses the API's bare-list response to close visits, complete care in progress and cancel other appointments", async () => {
    const visits: Array<MockVisitState> = [
      {
        uuid: 'visit-1',
        encounters: [{ encounterDatetime: '2026-08-12T16:30:00.000Z' }],
        startDatetime: '2026-08-12T14:00:00.000Z',
        stopDatetime: null,
      },
      { uuid: 'visit-2', startDatetime: '2026-08-12T15:00:00.000Z', stopDatetime: null },
    ];
    const appointments: Array<MockAppointmentState> = [
      { uuid: 'checked-in', status: 'CheckedIn' },
      { uuid: 'future', status: 'Scheduled' },
      { uuid: 'done', status: 'Completed' },
    ];
    mockGetQueueEntriesForVisit.mockImplementation(async (visitUuid) =>
      response({
        results:
          visitUuid === 'visit-1'
            ? [
                {
                  uuid: 'ended-queue-entry',
                  startedAt: '2026-08-12T16:40:00.000Z',
                  endedAt: '2026-08-12T16:50:00.000Z',
                },
              ]
            : [],
      }),
    );

    mockOpenmrsFetch.mockImplementation(async (url, init) => {
      const requestUrl = String(url);
      const visitResponse = handleVisitRequest(visits, url, init);
      if (visitResponse) {
        return visitResponse;
      }
      const appointmentResponse = handleAppointmentRequest(appointments, url, init);
      if (appointmentResponse) {
        return appointmentResponse;
      }
      throw new Error(`Unexpected request: ${requestUrl}`);
    });

    await expect(
      reconcileDeceasedPatientWorkflow({
        careContext: 'during-care',
        causeOfDeath: 'cause-uuid',
        deathDate: new Date('2026-08-12T15:41:28.000Z'),
        patientUuid: 'patient-uuid',
      }),
    ).resolves.toEqual({
      cancelledAppointments: 1,
      closedQueueEntries: 0,
      closedVisits: 2,
      completedAppointments: 1,
    });

    expect(mockMarkPatientDeceased).toHaveBeenCalledOnce();
    expect(mockOpenmrsFetch).toHaveBeenCalledWith(`${restBaseUrl}/clinicalvisitclosure`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: {
        visitUuid: 'visit-1',
        stopDatetime: '2026-08-12T16:50:00.000Z',
      },
    });
    expect(mockDrainActiveQueueEntriesForPatient.mock.invocationCallOrder[0]).toBeLessThan(
      mockDrainActiveQueueEntriesForVisit.mock.invocationCallOrder[0],
    );
    expect(mockDrainActiveQueueEntriesForVisit.mock.invocationCallOrder[0]).toBeLessThan(
      mockGetQueueEntriesForVisit.mock.invocationCallOrder[0],
    );
    expect(mockOpenmrsFetch).toHaveBeenCalledWith(`${restBaseUrl}/appointments/checked-in/status-change`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: {
        toStatus: 'Completed',
        onDate: '2026-08-12T16:19:24.000Z',
      },
    });
    expect(mockOpenmrsFetch).toHaveBeenCalledWith(`${restBaseUrl}/appointments/future/status-change`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: {
        toStatus: 'Cancelled',
        onDate: '2026-08-12T16:19:24.000Z',
      },
    });
    expect(mockOpenmrsFetch.mock.calls.some(([url]) => String(url).includes('/appointment?uuid=done'))).toBe(false);
  });

  it('cancels a checked-in appointment when the death is recorded outside active care', async () => {
    const appointments: Array<MockAppointmentState> = [{ uuid: 'checked-in', status: 'CheckedIn' }];

    mockOpenmrsFetch.mockImplementation(async (url, init) => {
      const requestUrl = String(url);
      if (requestUrl.includes('/visit?')) return response({ results: [] });
      const appointmentResponse = handleAppointmentRequest(appointments, url, init);
      if (appointmentResponse) {
        return appointmentResponse;
      }
      throw new Error(`Unexpected request: ${requestUrl}`);
    });

    await reconcileDeceasedPatientWorkflow({
      careContext: 'outside-care',
      causeOfDeath: 'cause-uuid',
      deathDate: new Date('2026-08-12T15:41:28.000Z'),
      patientUuid: 'patient-uuid',
    });

    expect(mockOpenmrsFetch).toHaveBeenCalledWith(`${restBaseUrl}/appointments/checked-in/status-change`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: expect.objectContaining({ toStatus: 'Cancelled' }),
    });
  });

  it('skips the person mutation on retry when the authoritative patient is already deceased', async () => {
    mockFetchFreshPatientVitalStatus.mockReset().mockResolvedValue({
      dead: true,
      deathDate: '2026-08-12T15:41:28.000Z',
      isDeceased: true,
    });
    mockOpenmrsFetch.mockImplementation(async (url) => {
      const requestUrl = String(url);
      if (requestUrl.includes('/visit?')) return response({ results: [] });
      if (requestUrl.endsWith('/appointments/search') || requestUrl.endsWith('/appointment/search')) {
        return response([]);
      }
      throw new Error(`Unexpected request: ${requestUrl}`);
    });

    await expect(
      reconcileDeceasedPatientWorkflow({
        careContext: 'during-care',
        deathDate: new Date('2026-08-12T15:41:28.000Z'),
        patientUuid: 'patient-uuid',
      }),
    ).resolves.toMatchObject({ closedVisits: 0, closedQueueEntries: 0 });

    expect(mockMarkPatientDeceased).not.toHaveBeenCalled();
    expect(mockDrainActiveQueueEntriesForPatient).toHaveBeenCalledWith('patient-uuid');
  });

  it('does not reconcile operational state when a successful death response was not persisted', async () => {
    mockFetchFreshPatientVitalStatus.mockReset();
    mockFetchFreshPatientVitalStatus.mockResolvedValue({ dead: false, deathDate: null, isDeceased: false });

    await expect(
      reconcileDeceasedPatientWorkflow({
        careContext: 'during-care',
        deathDate: new Date('2026-08-12T15:41:28.000Z'),
        patientUuid: 'patient-uuid',
      }),
    ).rejects.toMatchObject({ code: 'DECEASED_PATIENT_MARK_UNVERIFIED' });

    expect(mockMarkPatientDeceased).toHaveBeenCalledOnce();
    expect(mockFetchFreshPatientVitalStatus).toHaveBeenCalledTimes(2);
    expect(mockDrainActiveQueueEntriesForPatient).not.toHaveBeenCalled();
    expect(mockDrainActiveQueueEntriesForVisit).not.toHaveBeenCalled();
    expect(mockOpenmrsFetch).not.toHaveBeenCalled();
  });

  it('continues after a lost death response when a fresh read confirms it was persisted', async () => {
    mockMarkPatientDeceased.mockRejectedValue(new Error('connection closed before response'));
    mockOpenmrsFetch.mockImplementation(async (url) => {
      const requestUrl = String(url);
      if (requestUrl.includes('/visit?')) return response({ results: [] });
      if (requestUrl.endsWith('/appointments/search') || requestUrl.endsWith('/appointment/search')) {
        return response([]);
      }
      throw new Error(`Unexpected request: ${requestUrl}`);
    });

    await expect(
      reconcileDeceasedPatientWorkflow({
        careContext: 'during-care',
        deathDate: new Date('2026-08-12T15:41:28.000Z'),
        patientUuid: 'patient-uuid',
      }),
    ).resolves.toEqual({
      cancelledAppointments: 0,
      closedQueueEntries: 0,
      closedVisits: 0,
      completedAppointments: 0,
    });

    expect(mockMarkPatientDeceased).toHaveBeenCalledOnce();
    expect(mockFetchFreshPatientVitalStatus).toHaveBeenCalledTimes(2);
    expect(mockDrainActiveQueueEntriesForPatient).toHaveBeenCalledTimes(2);
  });

  it('drains every capped page of dated and undated non-terminal appointments', async () => {
    const appointments: Array<MockAppointmentState> = [
      ...Array.from({ length: 60 }, (_, index) => ({ uuid: `dated-${index}`, status: 'Scheduled' })),
      ...Array.from({ length: 55 }, (_, index) => ({
        uuid: `undated-${index}`,
        status: 'Requested',
        withoutDates: true,
      })),
    ];

    mockOpenmrsFetch.mockImplementation(async (url, init) => {
      const requestUrl = String(url);
      if (requestUrl.includes('/visit?')) return response({ results: [] });
      const appointmentResponse = handleAppointmentRequest(appointments, url, init);
      if (appointmentResponse) {
        return appointmentResponse;
      }
      throw new Error(`Unexpected request: ${requestUrl}`);
    });

    await expect(
      reconcileDeceasedPatientWorkflow({
        careContext: 'outside-care',
        deathDate: new Date('2026-08-12T15:41:28.000Z'),
        patientUuid: 'patient-uuid',
      }),
    ).resolves.toEqual({
      cancelledAppointments: 115,
      closedQueueEntries: 0,
      closedVisits: 0,
      completedAppointments: 0,
    });

    const datedScheduledSearches = mockOpenmrsFetch.mock.calls.filter(
      ([url, init]) =>
        String(url).endsWith('/appointments/search') &&
        (init?.body as { status?: string })?.status === 'Scheduled',
    );
    const undatedRequestedSearches = mockOpenmrsFetch.mock.calls.filter(
      ([url, init]) =>
        String(url).endsWith('/appointment/search') &&
        (init?.body as { status?: string })?.status === 'Requested',
    );

    expect(datedScheduledSearches).toHaveLength(3);
    expect(datedScheduledSearches[0][1]?.body).toEqual({
      patientUuid: 'patient-uuid',
      startDate: '1900-01-01T00:00:00.000Z',
      status: 'Scheduled',
    });
    expect(undatedRequestedSearches).toHaveLength(3);
    expect(undatedRequestedSearches[0][1]?.body).toEqual({
      patientUuids: ['patient-uuid'],
      status: 'Requested',
      withoutDates: true,
    });
  });

  it('fails when a successful appointment status response was not persisted', async () => {
    mockOpenmrsFetch.mockImplementation(async (url, init) => {
      const requestUrl = String(url);
      if (requestUrl.includes('/visit?')) return response({ results: [] });
      if (requestUrl.endsWith('/appointments/search')) {
        const status = (init?.body as { status?: string })?.status;
        return response(status === 'Scheduled' ? [{ uuid: 'future', status: 'Scheduled' }] : []);
      }
      if (requestUrl.endsWith('/appointment/search')) return response([]);
      if (requestUrl.includes('/appointment?uuid=future')) {
        return response({ uuid: 'future', status: 'Scheduled' });
      }
      if (requestUrl.endsWith('/appointments/future/status-change')) return response({});
      throw new Error(`Unexpected request: ${requestUrl}`);
    });

    const error = await reconcileDeceasedPatientWorkflow({
      careContext: 'outside-care',
      deathDate: new Date('2026-08-12T15:41:28.000Z'),
      patientUuid: 'patient-uuid',
    }).catch((reason) => reason);

    expect(error).toMatchObject({ code: 'DECEASED_PATIENT_RECONCILIATION_FAILED' });
    expect(error.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'DECEASED_PATIENT_APPOINTMENT_STATUS_CHANGE_UNVERIFIED' }),
      ]),
    );
    expect(
      mockOpenmrsFetch.mock.calls.filter(([url]) => String(url).endsWith('/appointments/future/status-change')),
    ).toHaveLength(1);
  });

  it('accepts a lost appointment response when a fresh read confirms the target status', async () => {
    let appointmentStatus = 'Scheduled';
    mockOpenmrsFetch.mockImplementation(async (url, init) => {
      const requestUrl = String(url);
      if (requestUrl.includes('/visit?')) return response({ results: [] });
      if (requestUrl.endsWith('/appointments/search')) {
        const status = (init?.body as { status?: string })?.status;
        return response(
          status === 'Scheduled' && appointmentStatus === 'Scheduled'
            ? [{ uuid: 'future', status: appointmentStatus }]
            : [],
        );
      }
      if (requestUrl.endsWith('/appointment/search')) return response([]);
      if (requestUrl.includes('/appointment?uuid=future')) {
        return response({ uuid: 'future', status: appointmentStatus });
      }
      if (requestUrl.endsWith('/appointments/future/status-change')) {
        appointmentStatus = 'Cancelled';
        throw new Error('connection closed before response');
      }
      throw new Error(`Unexpected request: ${requestUrl}`);
    });

    await expect(
      reconcileDeceasedPatientWorkflow({
        careContext: 'outside-care',
        deathDate: new Date('2026-08-12T15:41:28.000Z'),
        patientUuid: 'patient-uuid',
      }),
    ).resolves.toMatchObject({ cancelledAppointments: 1 });
  });

  it('rejects a lost appointment response when a fresh read still has the source status', async () => {
    mockOpenmrsFetch.mockImplementation(async (url, init) => {
      const requestUrl = String(url);
      if (requestUrl.includes('/visit?')) return response({ results: [] });
      if (requestUrl.endsWith('/appointments/search')) {
        const status = (init?.body as { status?: string })?.status;
        return response(status === 'Scheduled' ? [{ uuid: 'future', status: 'Scheduled' }] : []);
      }
      if (requestUrl.endsWith('/appointment/search')) return response([]);
      if (requestUrl.includes('/appointment?uuid=future')) {
        return response({ uuid: 'future', status: 'Scheduled' });
      }
      if (requestUrl.endsWith('/appointments/future/status-change')) {
        throw new Error('connection closed before response');
      }
      throw new Error(`Unexpected request: ${requestUrl}`);
    });

    const error = await reconcileDeceasedPatientWorkflow({
      careContext: 'outside-care',
      deathDate: new Date('2026-08-12T15:41:28.000Z'),
      patientUuid: 'patient-uuid',
    }).catch((reason) => reason);

    expect(error).toBeInstanceOf(AggregateError);
    expect(error).toMatchObject({ code: 'DECEASED_PATIENT_RECONCILIATION_FAILED' });
    expect(error.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ message: 'connection closed before response' })]),
    );
  });

  it('fresh-reads statuses and skips terminal appointments on retry', async () => {
    let returnedStaleSearchResult = false;
    mockOpenmrsFetch.mockImplementation(async (url) => {
      const requestUrl = String(url);
      if (requestUrl.includes('/visit?')) return response({ results: [] });
      if (requestUrl.endsWith('/appointments/search')) {
        if (!returnedStaleSearchResult) {
          returnedStaleSearchResult = true;
          return response([{ uuid: 'completed', status: 'CheckedIn' }]);
        }
        return response([]);
      }
      if (requestUrl.endsWith('/appointment/search')) return response([]);
      if (requestUrl.includes('/appointment?uuid=completed')) {
        return response({ uuid: 'completed', status: 'Completed' });
      }
      throw new Error(`Unexpected request: ${requestUrl}`);
    });

    await expect(
      reconcileDeceasedPatientWorkflow({
        careContext: 'during-care',
        deathDate: new Date('2026-08-12T15:41:28.000Z'),
        patientUuid: 'patient-uuid',
      }),
    ).resolves.toEqual({
      cancelledAppointments: 0,
      closedQueueEntries: 0,
      closedVisits: 0,
      completedAppointments: 0,
    });

    expect(mockOpenmrsFetch.mock.calls.some(([url]) => String(url).includes('/status-change'))).toBe(false);
  });

  it('fails retryably instead of looping when a stale search page never advances', async () => {
    mockOpenmrsFetch.mockImplementation(async (url, init) => {
      const requestUrl = String(url);
      if (requestUrl.includes('/visit?')) return response({ results: [] });
      if (
        requestUrl.endsWith('/appointments/search') &&
        (init?.body as { status?: string })?.status === 'CheckedIn'
      ) {
        return response([{ uuid: 'completed', status: 'CheckedIn' }]);
      }
      if (requestUrl.endsWith('/appointments/search') || requestUrl.endsWith('/appointment/search')) {
        return response([]);
      }
      if (requestUrl.includes('/appointment?uuid=completed')) {
        return response({ uuid: 'completed', status: 'Completed' });
      }
      throw new Error(`Unexpected request: ${requestUrl}`);
    });

    await expect(
      reconcileDeceasedPatientWorkflow({
        careContext: 'during-care',
        deathDate: new Date('2026-08-12T15:41:28.000Z'),
        patientUuid: 'patient-uuid',
      }),
    ).rejects.toMatchObject({ code: 'DECEASED_PATIENT_RECONCILIATION_FAILED' });

    const checkedInSearches = mockOpenmrsFetch.mock.calls.filter(
      ([url, init]) =>
        String(url).endsWith('/appointments/search') &&
        (init?.body as { status?: string })?.status === 'CheckedIn',
    );
    expect(checkedInSearches).toHaveLength(2);
  });

  it('accepts a lost visit-closure response when the visit is already closed', async () => {
    let visitClosed = false;
    mockOpenmrsFetch.mockImplementation(async (url) => {
      const requestUrl = String(url);
      if (requestUrl.includes('/visit?')) {
        return response({
          results: visitClosed
            ? []
            : [{ uuid: 'visit-1', startDatetime: '2026-08-12T14:00:00.000Z', stopDatetime: null }],
        });
      }
      if (requestUrl.endsWith('/clinicalvisitclosure')) {
        visitClosed = true;
        throw new Error('connection closed before response');
      }
      if (requestUrl.includes('/visit/visit-1?')) {
        return response({
          uuid: 'visit-1',
          startDatetime: '2026-08-12T14:00:00.000Z',
          stopDatetime: visitClosed ? '2026-08-12T16:19:24.999Z' : null,
        });
      }
      if (requestUrl.endsWith('/appointments/search') || requestUrl.endsWith('/appointment/search')) {
        return response([]);
      }
      throw new Error(`Unexpected request: ${requestUrl}`);
    });

    await expect(
      reconcileDeceasedPatientWorkflow({
        careContext: 'during-care',
        deathDate: new Date('2026-08-12T15:41:28.000Z'),
        patientUuid: 'patient-uuid',
      }),
    ).resolves.toEqual({
      cancelledAppointments: 0,
      closedQueueEntries: 0,
      closedVisits: 1,
      completedAppointments: 0,
    });
  });

  it('does not start visit closure when the patient queue drain fails', async () => {
    mockDrainActiveQueueEntriesForPatient.mockRejectedValueOnce(new Error('queue drain failed'));
    mockOpenmrsFetch.mockImplementation(async (url) => {
      const requestUrl = String(url);
      if (requestUrl.endsWith('/appointments/search') || requestUrl.endsWith('/appointment/search')) {
        return response([]);
      }
      throw new Error(`Unexpected request: ${requestUrl}`);
    });

    await expect(
      reconcileDeceasedPatientWorkflow({
        careContext: 'during-care',
        deathDate: new Date('2026-08-12T15:41:28.000Z'),
        patientUuid: 'patient-uuid',
      }),
    ).rejects.toMatchObject({ code: 'DECEASED_PATIENT_RECONCILIATION_FAILED' });

    expect(mockDrainActiveQueueEntriesForVisit).not.toHaveBeenCalled();
    expect(mockOpenmrsFetch.mock.calls.some(([url]) => String(url).includes('/visit?'))).toBe(false);
    expect(mockOpenmrsFetch.mock.calls.some(([url]) => String(url).endsWith('/clinicalvisitclosure'))).toBe(
      false,
    );
  });

  it('drains visit successors before closure and performs a final patient queue sweep', async () => {
    const visits: Array<MockVisitState> = [
      { uuid: 'visit-1', startDatetime: '2026-08-12T14:00:00.000Z', stopDatetime: null },
    ];
    const activeQueueEntries: Array<string> = [];
    mockDrainActiveQueueEntriesForPatient.mockImplementation(async () => {
      const transitioned = activeQueueEntries.length;
      activeQueueEntries.splice(0);
      if (mockDrainActiveQueueEntriesForPatient.mock.calls.length === 1) {
        activeQueueEntries.push('successor-before-visit-close');
      }
      return transitioned;
    });
    mockDrainActiveQueueEntriesForVisit.mockImplementation(async () => {
      const transitioned = activeQueueEntries.length;
      activeQueueEntries.splice(0);
      return transitioned;
    });
    mockOpenmrsFetch.mockImplementation(async (url, init) => {
      const visitResponse = handleVisitRequest(visits, url, init);
      if (visitResponse) {
        if (String(url).endsWith('/clinicalvisitclosure')) {
          activeQueueEntries.push('successor-after-visit-close');
        }
        return visitResponse;
      }
      const requestUrl = String(url);
      if (requestUrl.endsWith('/appointments/search') || requestUrl.endsWith('/appointment/search')) {
        return response([]);
      }
      throw new Error(`Unexpected request: ${requestUrl}`);
    });

    await expect(
      reconcileDeceasedPatientWorkflow({
        careContext: 'during-care',
        deathDate: new Date('2026-08-12T15:41:28.000Z'),
        patientUuid: 'patient-uuid',
      }),
    ).resolves.toMatchObject({ closedQueueEntries: 2, closedVisits: 1 });

    expect(activeQueueEntries).toEqual([]);
    expect(mockDrainActiveQueueEntriesForPatient).toHaveBeenCalledTimes(2);
    expect(mockDrainActiveQueueEntriesForVisit).toHaveBeenCalledWith('visit-1');
    expect(mockDrainActiveQueueEntriesForVisit.mock.invocationCallOrder[0]).toBeLessThan(
      mockGetQueueEntriesForVisit.mock.invocationCallOrder[0],
    );
    expect(mockGetQueueEntriesForVisit.mock.invocationCallOrder[0]).toBeLessThan(
      mockDrainActiveQueueEntriesForPatient.mock.invocationCallOrder[1],
    );
  });

  it('drains more than 100 active visits and counts only verified transitions', async () => {
    const visits: Array<MockVisitState> = Array.from({ length: 101 }, (_, index) => ({
      uuid: `visit-${index}`,
      startDatetime: '2026-08-12T14:00:00.000Z',
      stopDatetime: null,
    }));
    mockOpenmrsFetch.mockImplementation(async (url, init) => {
      const visitResponse = handleVisitRequest(visits, url, init);
      if (visitResponse) return visitResponse;
      const requestUrl = String(url);
      if (requestUrl.endsWith('/appointments/search') || requestUrl.endsWith('/appointment/search')) {
        return response([]);
      }
      throw new Error(`Unexpected request: ${requestUrl}`);
    });

    await expect(
      reconcileDeceasedPatientWorkflow({
        careContext: 'during-care',
        deathDate: new Date('2026-08-12T15:41:28.000Z'),
        patientUuid: 'patient-uuid',
      }),
    ).resolves.toMatchObject({ closedVisits: 101 });

    const searches = mockOpenmrsFetch.mock.calls.filter(([url]) => String(url).includes('/visit?'));
    expect(searches).toHaveLength(3);
  });

  it('fails instead of looping when an already closed visit remains in the active search', async () => {
    mockOpenmrsFetch.mockImplementation(async (url) => {
      const requestUrl = String(url);
      if (requestUrl.includes('/visit?')) {
        return response({
          results: [{ uuid: 'stale-visit', startDatetime: '2026-08-12T14:00:00.000Z', stopDatetime: null }],
        });
      }
      if (requestUrl.includes('/visit/stale-visit?')) {
        return response({ uuid: 'stale-visit', stopDatetime: '2026-08-12T16:19:24.999Z' });
      }
      if (requestUrl.endsWith('/appointments/search') || requestUrl.endsWith('/appointment/search')) {
        return response([]);
      }
      throw new Error(`Unexpected request: ${requestUrl}`);
    });

    await expect(
      reconcileDeceasedPatientWorkflow({
        careContext: 'during-care',
        deathDate: new Date('2026-08-12T15:41:28.000Z'),
        patientUuid: 'patient-uuid',
      }),
    ).rejects.toMatchObject({ code: 'DECEASED_PATIENT_RECONCILIATION_FAILED' });

    const searches = mockOpenmrsFetch.mock.calls.filter(([url]) => String(url).includes('/visit?'));
    expect(searches).toHaveLength(2);
    expect(mockOpenmrsFetch.mock.calls.some(([url]) => String(url).endsWith('/clinicalvisitclosure'))).toBe(false);
  });

  it('fails closed when a successful visit-closure response was not persisted', async () => {
    mockOpenmrsFetch.mockImplementation(async (url) => {
      const requestUrl = String(url);
      if (requestUrl.includes('/visit?')) {
        return response({
          results: [{ uuid: 'visit-1', startDatetime: '2026-08-12T14:00:00.000Z', stopDatetime: null }],
        });
      }
      if (requestUrl.includes('/visit/visit-1?')) {
        return response({ uuid: 'visit-1', startDatetime: '2026-08-12T14:00:00.000Z', stopDatetime: null });
      }
      if (requestUrl.endsWith('/clinicalvisitclosure')) return response({});
      if (requestUrl.endsWith('/appointments/search') || requestUrl.endsWith('/appointment/search')) {
        return response([]);
      }
      throw new Error(`Unexpected request: ${requestUrl}`);
    });

    await expect(
      reconcileDeceasedPatientWorkflow({
        careContext: 'during-care',
        deathDate: new Date('2026-08-12T15:41:28.000Z'),
        patientUuid: 'patient-uuid',
      }),
    ).rejects.toMatchObject({ code: 'DECEASED_PATIENT_RECONCILIATION_FAILED' });
  });

  it('surfaces a retryable reconciliation error after attempting visits and appointments', async () => {
    const appointments: Array<MockAppointmentState> = [{ uuid: 'future', status: 'Scheduled' }];

    mockOpenmrsFetch.mockImplementation(async (url, init) => {
      const requestUrl = String(url);
      if (requestUrl.includes('/visit?')) {
        return response({
          results: [{ uuid: 'visit-1', startDatetime: '2026-08-12T14:00:00.000Z', stopDatetime: null }],
        });
      }
      if (requestUrl.endsWith('/clinicalvisitclosure')) throw new Error('visit closure failed');
      if (requestUrl.includes('/visit/visit-1?')) {
        return response({ uuid: 'visit-1', stopDatetime: null });
      }
      const appointmentResponse = handleAppointmentRequest(appointments, url, init);
      if (appointmentResponse) {
        return appointmentResponse;
      }
      throw new Error(`Unexpected request: ${requestUrl}`);
    });

    await expect(
      reconcileDeceasedPatientWorkflow({
        careContext: 'during-care',
        deathDate: new Date('2026-08-12T15:41:28.000Z'),
        patientUuid: 'patient-uuid',
      }),
    ).rejects.toMatchObject({ code: 'DECEASED_PATIENT_RECONCILIATION_FAILED' });

    expect(mockOpenmrsFetch.mock.calls.some(([url]) => String(url).includes('/status-change'))).toBe(true);
  });
});
