import { openmrsFetch, restBaseUrl, type Visit } from '@openmrs/esm-framework';

import { getPatientChartStore } from '../store/patient-chart-store';
import { postOrders, postOrdersOnNewEncounter } from './postOrders';
import { _resetOrderBasketStore, orderBasketStore } from './store';
import type { OrderBasketItem, PostDataPrepFunction } from './types';

vi.mock('@openmrs/esm-framework', async () => {
  const actual = await vi.importActual<typeof import('@openmrs/esm-framework')>('@openmrs/esm-framework');
  return {
    ...actual,
    openmrsFetch: vi.fn(),
    translateFrom: vi.fn((_moduleName: string, _key: string, fallback: string) => fallback),
  };
});

describe('postOrders preflight', () => {
  const firstOrder: OrderBasketItem = { action: 'NEW', display: 'Synthetic first order', uuid: 'synthetic-first' };
  const onceOrder: OrderBasketItem = { action: 'RENEW', display: 'Synthetic once order', uuid: 'synthetic-once' };
  const prepare: PostDataPrepFunction = (order, patientUuid, encounterUuid) => ({
    action: order.action,
    patient: patientUuid,
    encounter: encounterUuid ?? undefined,
    concept: order.uuid,
  });

  beforeEach(() => {
    mockOpenmrsFetch.mockReset();
    mockOpenmrsFetch.mockResolvedValue({ data: { uuid: 'synthetic-saved-order' } } as never);
    _resetOrderBasketStore();
    getPatientChartStore().setState({ patientUuid: 'synthetic-patient' });
    orderBasketStore.setState({
      items: { 'synthetic-patient': { medications: [firstOrder, onceOrder] } },
      postDataPrepFunctions: { medications: prepare },
    });
  });

  it('keeps every unsent order and makes zero writes when a later once draft fails preparation', async () => {
    orderBasketStore.setState({
      postDataPrepFunctions: {
        medications: (order, ...args) => {
          if (order.uuid === onceOrder.uuid) throw new Error('Private clinical validation details');
          return prepare(order, ...args);
        },
      },
    });

    const unsent = await postOrders('synthetic-encounter', new AbortController());
    expect(mockOpenmrsFetch).not.toHaveBeenCalled();
    expect(unsent.map((order) => order.uuid)).toEqual([firstOrder.uuid, onceOrder.uuid]);
    for (const order of unsent) {
      expect(order.extractedOrderError?.fieldErrors).toEqual([
        'Could not submit this order. Review the data and try again.',
      ]);
      expect(order.orderError?.message).not.toContain('Private clinical');
    }
  });

  it('keeps all unsent groups when a group has no registered preparation function', async () => {
    orderBasketStore.setState({
      items: { 'synthetic-patient': { medications: [firstOrder], 'missing-group': [onceOrder] } },
    });

    const unsent = await postOrders('synthetic-encounter', new AbortController());
    expect(mockOpenmrsFetch).not.toHaveBeenCalled();
    expect(unsent.map((order) => order.uuid)).toEqual([firstOrder.uuid, onceOrder.uuid]);
    expect(unsent.every((order) => order.extractedOrderError?.fieldErrors.length === 1)).toBe(true);
  });

  it('preserves per-order backend failures and lets the caller retry only failed orders', async () => {
    const backendError = {
      responseBody: { error: { fieldErrors: { dose: [{ message: 'Synthetic backend validation' }] } } },
    };
    mockOpenmrsFetch.mockResolvedValueOnce({ data: { uuid: 'synthetic-saved-first' } } as never);
    mockOpenmrsFetch.mockRejectedValueOnce(backendError);

    const failed = await postOrders('synthetic-encounter', new AbortController());
    expect(mockOpenmrsFetch).toHaveBeenCalledTimes(2);
    expect(failed).toEqual([
      expect.objectContaining({
        uuid: onceOrder.uuid,
        orderError: backendError,
        extractedOrderError: expect.objectContaining({ fieldErrors: ['Synthetic backend validation'] }),
      }),
    ]);
    orderBasketStore.setState({ items: { 'synthetic-patient': { medications: failed } } });
    expect(await postOrders('synthetic-encounter', new AbortController())).toEqual([]);
    expect(mockOpenmrsFetch).toHaveBeenCalledTimes(3);
    expect(mockOpenmrsFetch.mock.calls[2]?.[1]?.body).toMatchObject({ concept: onceOrder.uuid });
  });

  it('still rejects a new-encounter batch before posting when a draft cannot be prepared', async () => {
    orderBasketStore.setState({
      postDataPrepFunctions: {
        medications: (order, ...args) => {
          if (order.uuid === onceOrder.uuid) throw new Error('Synthetic preparation failure');
          return prepare(order, ...args);
        },
      },
    });
    await expect(
      postOrdersOnNewEncounter('synthetic-patient', 'synthetic-encounter-type', null, 'synthetic-location'),
    ).rejects.toThrow('Synthetic preparation failure');
    expect(mockOpenmrsFetch).not.toHaveBeenCalled();
  });
});

const mockOpenmrsFetch = vi.mocked(openmrsFetch);

function getFirstRequestBody(): object {
  const firstCall = mockOpenmrsFetch.mock.calls[0];
  if (!firstCall) {
    throw new Error('Expected openmrsFetch to have been called');
  }

  const body = firstCall[1]?.body;
  if (!body || typeof body !== 'object') {
    throw new Error('Expected the first openmrsFetch call to contain an object body');
  }

  return body;
}

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

  it('omits the encounterDatetime for an active visit with no stop date', async () => {
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
    expect(getFirstRequestBody()).not.toHaveProperty('encounterDatetime');
  });

  it('omits the encounterDatetime when there is no active visit', async () => {
    await postOrdersOnNewEncounter('patient-uuid', 'encounter-type-uuid', null, 'location-uuid', new AbortController());

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
    expect(getFirstRequestBody()).not.toHaveProperty('encounterDatetime');
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

    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('not currently active'));
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

  it('uses the server clock when the provided visit has no valid start date', async () => {
    const invalidVisit = {
      uuid: 'visit-uuid',
      startDatetime: 'invalid-date',
      stopDatetime: null,
    } as Visit;

    await postOrdersOnNewEncounter(
      'patient-uuid',
      'encounter-type-uuid',
      invalidVisit,
      'location-uuid',
      new AbortController(),
    );

    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('not currently active'));
    expect(getFirstRequestBody()).not.toHaveProperty('encounterDatetime');
  });
});
