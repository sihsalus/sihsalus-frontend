import { openmrsFetch, restBaseUrl, type Visit } from '@openmrs/esm-framework';

import { postOrdersOnNewEncounter } from './postOrders';
import { _resetOrderBasketStore, orderBasketStore } from './store';

vi.mock('@openmrs/esm-framework', async () => {
  const actual = await vi.importActual<typeof import('@openmrs/esm-framework')>('@openmrs/esm-framework');
  return {
    ...actual,
    openmrsFetch: vi.fn(),
  };
});

const mockOpenmrsFetch = vi.mocked(openmrsFetch);

describe('postOrdersOnNewEncounter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-21T15:00:00.000Z'));
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockOpenmrsFetch.mockResolvedValue({ data: { uuid: 'encounter-uuid' } } as never);
    _resetOrderBasketStore();
    orderBasketStore.setState({
      items: {
        'patient-uuid': {
          medications: [
            {
              action: 'NEW',
              display: 'Test medication',
            },
          ],
        },
      },
      postDataPrepFunctions: {
        medications: () => ({
          action: 'NEW',
          patient: 'patient-uuid',
          type: 'drugorder',
        }),
      },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('uses the current time for an active visit with no stop date', async () => {
    const activeVisit = {
      uuid: 'visit-uuid',
      startDatetime: '2026-05-21T10:00:00.000Z',
      stopDatetime: null,
    } as Visit;

    await postOrdersOnNewEncounter(
      'patient-uuid',
      'encounter-type-uuid',
      activeVisit,
      'location-uuid',
      new AbortController(),
    );

    expect(console.warn).not.toHaveBeenCalled();
    expect(mockOpenmrsFetch).toHaveBeenCalledWith(`${restBaseUrl}/encounter`, {
      headers: {
        'Content-Type': 'application/json',
      },
      method: 'POST',
      body: expect.objectContaining({
        patient: 'patient-uuid',
        location: 'location-uuid',
        encounterType: 'encounter-type-uuid',
        encounterDatetime: new Date('2026-05-21T15:00:00.000Z'),
        visit: 'visit-uuid',
        orders: [
          {
            action: 'NEW',
            patient: 'patient-uuid',
            type: 'drugorder',
          },
        ],
      }),
      signal: expect.any(AbortSignal),
    });
  });

  it('uses the current time when there is no active visit', async () => {
    await postOrdersOnNewEncounter(
      'patient-uuid',
      'encounter-type-uuid',
      null,
      'location-uuid',
      new AbortController(),
    );

    expect(console.warn).not.toHaveBeenCalled();
    expect(mockOpenmrsFetch).toHaveBeenCalledWith(`${restBaseUrl}/encounter`, {
      headers: {
        'Content-Type': 'application/json',
      },
      method: 'POST',
      body: expect.objectContaining({
        patient: 'patient-uuid',
        location: 'location-uuid',
        encounterType: 'encounter-type-uuid',
        encounterDatetime: new Date('2026-05-21T15:00:00.000Z'),
        visit: undefined,
        orders: [
          {
            action: 'NEW',
            patient: 'patient-uuid',
            type: 'drugorder',
          },
        ],
      }),
      signal: expect.any(AbortSignal),
    });
  });

  it('warns and uses the visit start date when the provided visit is not active', async () => {
    const inactiveVisit = {
      uuid: 'visit-uuid',
      startDatetime: '2026-05-21T10:00:00.000Z',
      stopDatetime: '2026-05-21T11:00:00.000Z',
    } as Visit;

    await postOrdersOnNewEncounter(
      'patient-uuid',
      'encounter-type-uuid',
      inactiveVisit,
      'location-uuid',
      new AbortController(),
    );

    expect(console.warn).toHaveBeenCalled();
    expect(mockOpenmrsFetch).toHaveBeenCalledWith(`${restBaseUrl}/encounter`, {
      headers: {
        'Content-Type': 'application/json',
      },
      method: 'POST',
      body: expect.objectContaining({
        patient: 'patient-uuid',
        location: 'location-uuid',
        encounterType: 'encounter-type-uuid',
        encounterDatetime: new Date('2026-05-21T10:00:00.000Z'),
        visit: 'visit-uuid',
        orders: [
          {
            action: 'NEW',
            patient: 'patient-uuid',
            type: 'drugorder',
          },
        ],
      }),
      signal: expect.any(AbortSignal),
    });
  });
});
