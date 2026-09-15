import { openmrsFetch } from '@openmrs/esm-framework';
import {
  type ArrivalPaymentConfirmation,
  assertArrivalPaymentAttributeConfigured,
  ensureArrivalPaymentSaved,
  ARRIVAL_PAYMENT_CONFIGURATION_MISSING,
  ARRIVAL_PAYMENT_NOT_SAVED,
} from './arrival-payment.resource';

const fetchMock = vi.mocked(openmrsFetch);
const confirmation: ArrivalPaymentConfirmation = {
  version: 1,
  confirmed: true,
  financingUuid: 'non-sis',
  appointmentUuid: 'appointment',
  confirmedBy: 'operator',
  confirmedAt: '2026-09-11T14:00:00.000Z',
};
const attribute = { uuid: 'attribute', attributeType: { uuid: 'type' }, value: JSON.stringify(confirmation) };
const response = (data: unknown) => ({ data }) as Awaited<ReturnType<typeof openmrsFetch>>;

beforeEach(() => {
  fetchMock.mockReset();
});

it('creates the visit attribute and verifies the saved confirmation', async () => {
  fetchMock
    .mockResolvedValueOnce(response({ results: [] }))
    .mockResolvedValueOnce(response({}))
    .mockResolvedValueOnce(response({ results: [attribute] }));
  await ensureArrivalPaymentSaved('visit', 'type', confirmation);
  expect(fetchMock).toHaveBeenNthCalledWith(
    2,
    expect.stringContaining('/visit/visit/attribute'),
    expect.objectContaining({ method: 'POST', body: { attributeType: 'type', value: JSON.stringify(confirmation) } }),
  );
  expect(fetchMock).toHaveBeenCalledTimes(3);
});

it('does not duplicate a confirmation already stored on the visit', async () => {
  fetchMock.mockResolvedValue(response({ results: [attribute] }));
  await ensureArrivalPaymentSaved('visit', 'type', confirmation);
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it('updates an existing confirmation instead of adding a second single-valued attribute', async () => {
  fetchMock
    .mockResolvedValueOnce(response({ results: [{ ...attribute, value: '{}' }] }))
    .mockResolvedValueOnce(response({}))
    .mockResolvedValueOnce(response({ results: [attribute] }));
  await ensureArrivalPaymentSaved('visit', 'type', confirmation);
  expect(fetchMock).toHaveBeenNthCalledWith(
    2,
    expect.stringContaining('/visit/visit/attribute/attribute'),
    expect.objectContaining({ method: 'POST' }),
  );
});

it('blocks continuation if the write is not present when read back', async () => {
  fetchMock.mockResolvedValue(response({ results: [] }));
  await expect(ensureArrivalPaymentSaved('visit', 'type', confirmation)).rejects.toMatchObject({
    code: ARRIVAL_PAYMENT_NOT_SAVED,
  });
});

it('reconciles a lost response without duplicating a successful write', async () => {
  fetchMock
    .mockResolvedValueOnce(response({ results: [] }))
    .mockRejectedValueOnce(new Error('Connection interrupted'))
    .mockResolvedValueOnce(response({ results: [attribute] }));
  await expect(ensureArrivalPaymentSaved('visit', 'type', confirmation)).resolves.toBeUndefined();
  expect(fetchMock).toHaveBeenCalledTimes(3);
});

it('rejects an unavailable or incompatible visit attribute before opening the visit form', async () => {
  fetchMock.mockRejectedValueOnce(new Error('Not found'));
  await expect(assertArrivalPaymentAttributeConfigured('type')).rejects.toMatchObject({
    code: ARRIVAL_PAYMENT_CONFIGURATION_MISSING,
  });
  fetchMock.mockResolvedValueOnce(response({ datatypeClassname: 'BooleanDatatype' }));
  await expect(assertArrivalPaymentAttributeConfigured('type')).rejects.toMatchObject({
    code: ARRIVAL_PAYMENT_CONFIGURATION_MISSING,
  });
});
