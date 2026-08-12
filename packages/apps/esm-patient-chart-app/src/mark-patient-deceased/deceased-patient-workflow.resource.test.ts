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

describe('reconcileDeceasedPatientWorkflow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMarkPatientDeceased.mockResolvedValue({} as Awaited<ReturnType<typeof markPatientDeceased>>);
    vi.mocked(toOmrsIsoString).mockImplementation((value) => new Date(value).toISOString());
  });

  it('marks the patient, closes active visits, completes care in progress and cancels the other appointments', async () => {
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
      if (requestUrl.endsWith('/appointments/search')) {
        return response({
          data: [
            { uuid: 'checked-in', status: 'CheckedIn' },
            { uuid: 'future', status: 'Scheduled' },
            { uuid: 'done', status: 'Completed' },
          ],
        });
      }
      if (requestUrl.includes('/appointment?uuid=checked-in')) {
        return response({ uuid: 'checked-in', status: 'CheckedIn' });
      }
      if (requestUrl.includes('/appointment?uuid=future')) {
        return response({ uuid: 'future', status: 'Scheduled' });
      }
      if (requestUrl.includes('/status-change')) {
        return response({ status: (init?.body as { toStatus: string }).toStatus });
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
    mockOpenmrsFetch.mockImplementation(async (url, init) => {
      const requestUrl = String(url);
      if (requestUrl.includes('/visit?')) return response({ results: [] });
      if (requestUrl.endsWith('/appointments/search')) {
        return response({ data: [{ uuid: 'checked-in', status: 'CheckedIn' }] });
      }
      if (requestUrl.includes('/appointment?uuid=checked-in')) {
        return response({ uuid: 'checked-in', status: 'CheckedIn' });
      }
      if (requestUrl.includes('/status-change')) {
        return response({ status: (init?.body as { toStatus: string }).toStatus });
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

  it('fresh-reads statuses and skips terminal appointments on retry', async () => {
    mockOpenmrsFetch.mockImplementation(async (url) => {
      const requestUrl = String(url);
      if (requestUrl.includes('/visit?')) return response({ results: [] });
      if (requestUrl.endsWith('/appointments/search')) {
        return response({ data: [{ uuid: 'completed', status: 'CheckedIn' }] });
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
    ).resolves.toEqual({ cancelledAppointments: 0, closedVisits: 0, completedAppointments: 0 });

    expect(mockOpenmrsFetch.mock.calls.some(([url]) => String(url).includes('/status-change'))).toBe(false);
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
      if (requestUrl.endsWith('/appointments/search')) return response({ data: [] });
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
    mockOpenmrsFetch.mockImplementation(async (url) => {
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
      if (requestUrl.endsWith('/appointments/search')) {
        return response({ data: [{ uuid: 'future', status: 'Scheduled' }] });
      }
      if (requestUrl.includes('/appointment?uuid=future')) {
        return response({ uuid: 'future', status: 'Scheduled' });
      }
      if (requestUrl.includes('/status-change')) return response({ status: 'Cancelled' });
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
