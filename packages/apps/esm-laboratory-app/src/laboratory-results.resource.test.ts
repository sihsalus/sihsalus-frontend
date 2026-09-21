import { type FetchResponse, openmrsFetch } from '@openmrs/esm-framework';
import {
  fetchLabOrderResult,
  fetchLabOrderResults,
  getResultPatientUuid,
  type LabResultObservation,
} from './laboratory-results.resource';
import { resultObservation, resultOrder } from './laboratory-results.test-fixtures';

const fetch = vi.mocked(openmrsFetch);
const response = (data: unknown) => ({ data }) as FetchResponse<unknown>;
const encounter = () => ({
  uuid: resultOrder.encounter.uuid,
  patient: { uuid: resultOrder.patient.uuid },
  obs: [{ uuid: resultObservation.uuid, voided: false, order: { uuid: resultOrder.uuid }, obsGroup: null }],
});

beforeEach(() => {
  fetch.mockReset();
});

it('loads only the selected persisted order, encounter and observation, including numeric zero', async () => {
  fetch
    .mockResolvedValueOnce(response(resultOrder))
    .mockResolvedValueOnce(response(encounter()))
    .mockResolvedValueOnce(response(resultObservation));
  const signal = new AbortController().signal;
  expect(await fetchLabOrderResult(resultOrder, ['COMPLETED'], signal)).toEqual({
    order: resultOrder,
    observation: resultObservation,
  });
  expect(fetch.mock.calls.map(([url]) => url)).toEqual([
    expect.stringContaining('/order/synthetic-order-1?v=custom:'),
    expect.stringContaining('/encounter/synthetic-encounter?v=custom:'),
    expect.stringContaining('/obs/synthetic-observation?v=full'),
  ]);
  expect(fetch.mock.calls.every(([, options]) => options.signal === signal && !options.method)).toBe(true);
});

it.each([
  ['another patient', { patient: { uuid: 'other-patient' } }],
  ['another encounter', { encounter: { uuid: 'other-encounter' } }],
  ['another concept', { concept: { uuid: 'other-concept' } }],
  ['pending state', { fulfillerStatus: 'IN_PROGRESS' }],
  ['voided order', { voided: true }],
  ['discontinuation', { action: 'DISCONTINUE' }],
])('blocks a stale selection with %s', async (_, change) => {
  fetch.mockResolvedValueOnce(response({ ...resultOrder, ...change }));
  await expect(fetchLabOrderResult(resultOrder, ['COMPLETED'])).rejects.toThrow();
  expect(fetch).toHaveBeenCalledTimes(1);
});

it.each(['missing', 'ambiguous', 'other patient'])('blocks an encounter with %s results', async (condition) => {
  const data = encounter();
  if (condition === 'missing') data.obs = [];
  if (condition === 'ambiguous') data.obs.push({ ...data.obs[0], uuid: 'duplicate' });
  if (condition === 'other patient') data.patient.uuid = 'other';
  fetch.mockResolvedValueOnce(response(resultOrder)).mockResolvedValueOnce(response(data));
  await expect(fetchLabOrderResult(resultOrder, ['COMPLETED'])).rejects.toThrow();
  expect(fetch).toHaveBeenCalledTimes(2);
});

it.each([
  { person: { uuid: 'other' } },
  { encounter: { uuid: 'other' } },
  { order: { uuid: 'other' } },
  { uuid: 'other' },
  { concept: { uuid: 'other', display: 'Other' } },
  { voided: true },
  { value: null },
])('rejects inconsistent or missing observation data: %j', async (change) => {
  fetch
    .mockResolvedValueOnce(response(resultOrder))
    .mockResolvedValueOnce(response(encounter()))
    .mockResolvedValueOnce(response({ ...resultObservation, ...change }));
  await expect(fetchLabOrderResult(resultOrder, ['COMPLETED'])).rejects.toThrow();
});

it('validates nested panels, preserves coded/text values and excludes voided members', async () => {
  const panel: LabResultObservation = {
    ...resultObservation,
    value: null,
    groupMembers: [
      { ...resultObservation, uuid: 'coded', value: { uuid: 'answer', display: 'Negativo' }, order: null },
      {
        ...resultObservation,
        uuid: 'nested',
        value: null,
        groupMembers: [{ ...resultObservation, uuid: 'text', value: 'Texto guardado' }],
      },
      { ...resultObservation, uuid: 'old', voided: true, person: { uuid: 'other' } },
    ],
  };
  fetch
    .mockResolvedValueOnce(response(resultOrder))
    .mockResolvedValueOnce(response(encounter()))
    .mockResolvedValueOnce(response(panel));
  expect((await fetchLabOrderResult(resultOrder, ['COMPLETED'])).observation).toEqual(panel);
});

it('does not accept a panel containing another patient result', async () => {
  const panel = {
    ...resultObservation,
    groupMembers: [{ ...resultObservation, uuid: 'child', person: { uuid: 'other' } }],
  };
  fetch
    .mockResolvedValueOnce(response(resultOrder))
    .mockResolvedValueOnce(response(encounter()))
    .mockResolvedValueOnce(response(panel));
  await expect(fetchLabOrderResult(resultOrder, ['COMPLETED'])).rejects.toThrow();
});

it('ignores voided observations and member references when finding the root result', async () => {
  const data = encounter();
  data.obs.push(
    { ...data.obs[0], uuid: 'old', voided: true },
    { ...data.obs[0], uuid: 'member', obsGroup: { uuid: resultObservation.uuid } },
  );
  fetch
    .mockResolvedValueOnce(response(resultOrder))
    .mockResolvedValueOnce(response(data))
    .mockResolvedValueOnce(response(resultObservation));
  await expect(fetchLabOrderResult(resultOrder, ['COMPLETED'])).resolves.toBeDefined();
});

it('refuses empty and mixed-patient selections without a request', async () => {
  const mixed = [resultOrder, { ...resultOrder, uuid: 'second', patient: { ...resultOrder.patient, uuid: 'other' } }];
  expect(getResultPatientUuid(mixed)).toBeNull();
  await expect(fetchLabOrderResults(mixed)).rejects.toThrow();
  await expect(fetchLabOrderResults([])).rejects.toThrow();
  expect(fetch).not.toHaveBeenCalled();
});

it('does not repeat an order and never returns a partial report on request failure', async () => {
  fetch
    .mockResolvedValueOnce(response(resultOrder))
    .mockResolvedValueOnce(response(encounter()))
    .mockResolvedValueOnce(response(resultObservation));
  expect(await fetchLabOrderResults([resultOrder, resultOrder])).toHaveLength(1);
  expect(fetch).toHaveBeenCalledTimes(3);
  fetch.mockReset().mockRejectedValue(new Error('HTTP 403 private detail'));
  await expect(fetchLabOrderResults([resultOrder])).rejects.toThrow();
  expect(fetch).toHaveBeenCalledTimes(1);
});
