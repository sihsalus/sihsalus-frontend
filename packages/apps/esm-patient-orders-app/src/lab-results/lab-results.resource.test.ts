import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';

import {
  findLabResultObservationUuid,
  LabResultCompletionError,
  updateObservation,
  updateOrderResult,
} from './lab-results.resource';

const mockOpenmrsFetch = vi.mocked(openmrsFetch);

const orderPayload = {
  previousOrder: 'order-uuid',
  type: 'testorder',
  action: 'DISCONTINUE',
  careSetting: 'care-setting-uuid',
  encounter: 'encounter-uuid',
  patient: 'patient-uuid',
  concept: 'panel-concept-uuid',
  orderer: {
    uuid: 'provider-uuid',
    display: 'Proveedor Sintético',
    person: { display: 'Proveedor Sintético' },
  },
};

const groupedObservationPayload = {
  obs: [
    {
      concept: { uuid: 'panel-concept-uuid' },
      order: { uuid: 'order-uuid' },
      status: 'FINAL',
      obsDatetime: '2026-09-03T15:00:00.000Z',
      groupMembers: [
        {
          concept: { uuid: 'member-concept-uuid' },
          order: { uuid: 'order-uuid' },
          status: 'FINAL',
          obsDatetime: '2026-09-03T15:00:00.000Z',
          value: 12,
        },
      ],
    },
  ],
};

describe('laboratory result persistence', () => {
  beforeEach(() => {
    mockOpenmrsFetch.mockReset();
  });

  it('selects a result only when it is explicitly linked to the requested order', () => {
    const encounter = {
      obs: [
        {
          uuid: 'same-concept-other-order',
          concept: { uuid: 'panel-concept-uuid' },
          order: { uuid: 'other-order-uuid' },
        },
        {
          uuid: 'same-concept-without-order',
          concept: { uuid: 'panel-concept-uuid' },
        },
        {
          uuid: 'voided-result-for-order',
          voided: true,
          concept: { uuid: 'panel-concept-uuid' },
          order: { uuid: 'order-uuid' },
        },
        {
          uuid: 'active-result-for-order',
          concept: { uuid: 'panel-concept-uuid' },
          order: { uuid: 'order-uuid' },
        },
      ],
    };

    expect(findLabResultObservationUuid(encounter, 'order-uuid')).toBe('active-result-for-order');
  });

  it('does not fall back to another observation with the same concept', () => {
    const encounter = {
      obs: [
        {
          uuid: 'same-concept-other-order',
          concept: { uuid: 'panel-concept-uuid' },
          order: { uuid: 'other-order-uuid' },
        },
        {
          uuid: 'same-concept-without-order',
          concept: { uuid: 'panel-concept-uuid' },
        },
      ],
    };

    expect(findLabResultObservationUuid(encounter, 'order-uuid')).toBe('');
  });

  it('creates one standalone Obs tree without replacing encounter observations', async () => {
    mockOpenmrsFetch
      .mockResolvedValueOnce({ ok: true, data: { uuid: 'saved-observation-uuid' } } as never)
      .mockResolvedValueOnce({ ok: true, data: { uuid: 'order-uuid' } } as never);

    await updateOrderResult(
      'order-uuid',
      'encounter-uuid',
      groupedObservationPayload,
      { fulfillerStatus: 'COMPLETED', fulfillerComment: 'Test Results Entered' },
      orderPayload,
    );

    expect(mockOpenmrsFetch).toHaveBeenCalledTimes(2);
    expect(mockOpenmrsFetch.mock.calls[0]?.[0]).toBe(`${restBaseUrl}/obs`);
    expect(mockOpenmrsFetch.mock.calls.some(([url]) => String(url).includes('/encounter/'))).toBe(false);

    const createOptions = mockOpenmrsFetch.mock.calls[0]?.[1];
    const createdObservation = JSON.parse(String(createOptions?.body));
    expect(createdObservation).toMatchObject({
      person: 'patient-uuid',
      encounter: 'encounter-uuid',
      concept: { uuid: 'panel-concept-uuid' },
      groupMembers: [
        {
          person: 'patient-uuid',
          encounter: 'encounter-uuid',
          concept: { uuid: 'member-concept-uuid' },
          value: 12,
        },
      ],
    });
    expect(mockOpenmrsFetch.mock.calls[1]).toEqual([
      `${restBaseUrl}/order/order-uuid/fulfillerdetails/`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ fulfillerStatus: 'COMPLETED', fulfillerComment: 'Test Results Entered' }),
      }),
    ]);
  });

  it('does not complete the order when saving the observation fails', async () => {
    mockOpenmrsFetch.mockResolvedValueOnce({ ok: false, data: {} } as never);

    await expect(
      updateOrderResult(
        'order-uuid',
        'encounter-uuid',
        groupedObservationPayload,
        { fulfillerStatus: 'COMPLETED' },
        orderPayload,
      ),
    ).rejects.toThrow('Failed to save the laboratory observation');
    expect(mockOpenmrsFetch).toHaveBeenCalledOnce();
  });

  it('reports a recoverable partial save when only order completion fails', async () => {
    mockOpenmrsFetch
      .mockResolvedValueOnce({ ok: true, data: { uuid: 'saved-observation-uuid' } } as never)
      .mockRejectedValueOnce(new Error('synthetic status failure'));

    const error = await updateOrderResult(
      'order-uuid',
      'encounter-uuid',
      groupedObservationPayload,
      { fulfillerStatus: 'COMPLETED' },
      orderPayload,
    ).catch((reason) => reason);

    expect(error).toBeInstanceOf(LabResultCompletionError);
    expect(error).toMatchObject({ observationUuid: 'saved-observation-uuid' });
  });

  it('rejects ambiguous observation payloads before issuing a request', async () => {
    await expect(
      updateOrderResult('order-uuid', 'encounter-uuid', { obs: [] }, { fulfillerStatus: 'COMPLETED' }, orderPayload),
    ).rejects.toThrow('Exactly one laboratory observation group');
    expect(mockOpenmrsFetch).not.toHaveBeenCalled();
  });

  it('rejects an observation update without a UUID', async () => {
    await expect(updateObservation('', { value: 10 })).rejects.toThrow('valid observation UUID');
    expect(mockOpenmrsFetch).not.toHaveBeenCalled();
  });
});
