import { type FetchResponse, openmrsFetch, restBaseUrl, toOmrsIsoString } from '@openmrs/esm-framework';

import { markPatientDeceased } from '../data.resource';
import { reconcileDeceasedPatientWorkflow } from './deceased-patient-workflow.resource';

vi.mock('../data.resource', async () => ({
  markPatientDeceased: vi.fn(),
}));

const mockOpenmrsFetch = vi.mocked(openmrsFetch);
const mockMarkPatientDeceased = vi.mocked(markPatientDeceased);

function response<T>(data: T, date = 'Wed, 12 Aug 2026 16:19:24 GMT') {
  return { data, headers: new Headers({ Date: date }) } as FetchResponse<T>;
}

interface MockAppointmentState {
  status: string;
  uuid: string;
  withoutDates?: boolean;
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
    mockMarkPatientDeceased.mockResolvedValue({} as Awaited<ReturnType<typeof markPatientDeceased>>);
    vi.mocked(toOmrsIsoString).mockImplementation((value) => new Date(value).toISOString());
  });

  it("uses the API's bare-list response to close visits, complete care in progress and cancel other appointments", async () => {
    const appointments: Array<MockAppointmentState> = [
      { uuid: 'checked-in', status: 'CheckedIn' },
      { uuid: 'future', status: 'Scheduled' },
      { uuid: 'done', status: 'Completed' },
    ];

    mockOpenmrsFetch.mockImplementation(async (url, init) => {
      const requestUrl = String(url);
      if (requestUrl.includes('/visit?')) {
        return response({
          results: [
            { uuid: 'visit-1', startDatetime: '2026-08-12T14:00:00.000Z', stopDatetime: null },
            { uuid: 'visit-2', startDatetime: '2026-08-12T15:00:00.000Z', stopDatetime: null },
          ],
        });
      }
      if (requestUrl.endsWith('/clinicalvisitclosure')) {
        return response({});
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
      closedVisits: 2,
      completedAppointments: 1,
    });

    expect(mockMarkPatientDeceased).toHaveBeenCalledOnce();
    expect(mockOpenmrsFetch).toHaveBeenCalledWith(`${restBaseUrl}/clinicalvisitclosure`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: {
        visitUuid: 'visit-1',
        stopDatetime: '2026-08-12T16:19:24.000Z',
      },
    });
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
    ).resolves.toEqual({ cancelledAppointments: 115, closedVisits: 0, completedAppointments: 0 });

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
    ).resolves.toEqual({ cancelledAppointments: 0, closedVisits: 0, completedAppointments: 0 });

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
    mockOpenmrsFetch.mockImplementation(async (url) => {
      const requestUrl = String(url);
      if (requestUrl.includes('/visit?')) {
        return response({
          results: [{ uuid: 'visit-1', startDatetime: '2026-08-12T14:00:00.000Z', stopDatetime: null }],
        });
      }
      if (requestUrl.endsWith('/clinicalvisitclosure')) {
        throw new Error('connection closed before response');
      }
      if (requestUrl.includes('/visit/visit-1?')) {
        return response({
          uuid: 'visit-1',
          startDatetime: '2026-08-12T14:00:00.000Z',
          stopDatetime: '2026-08-12T16:19:24.000Z',
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
    ).resolves.toEqual({ cancelledAppointments: 0, closedVisits: 1, completedAppointments: 0 });
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
