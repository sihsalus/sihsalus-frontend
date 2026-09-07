import { type FetchResponse, getAttachmentByUuid, openmrsFetch } from '@openmrs/esm-framework';
import type { Order } from '@openmrs/esm-patient-common-lib';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getLabOrderPdfAttachments,
  getLabOrderPdfContext,
  getLabOrderPdfFilename,
  LAB_ORDER_PDF_NAMESPACE,
} from './lab-order-pdf.resource';

const orderUuid = '11111111-1111-1111-1111-111111111111';
const encounterUuid = '22222222-2222-2222-2222-222222222222';
const patientUuid = '33333333-3333-3333-3333-333333333333';
const attachmentUuid = '44444444-4444-4444-4444-444444444444';
const unrelatedAttachmentUuid = '55555555-5555-5555-5555-555555555555';

const order = {
  encounter: { uuid: encounterUuid },
  orderNumber: 'ORD-1',
  patient: { uuid: patientUuid },
  type: 'testorder',
  uuid: orderUuid,
} as Order;

const mockOpenmrsFetch = vi.mocked(openmrsFetch);
const mockGetAttachmentByUuid = vi.mocked(getAttachmentByUuid);

const fetchResponse = <T>(data: T) => ({ data }) as FetchResponse<T>;

describe('laboratory order PDF association', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not create context for a non-test order or missing persisted UUID', () => {
    expect(getLabOrderPdfContext({ ...order, type: 'drugorder' })).toBeNull();
    expect(getLabOrderPdfContext({ ...order, encounter: { uuid: '' } })).toBeNull();
  });

  it('uses only the non-PHI order UUID in the persisted filename', () => {
    expect(getLabOrderPdfFilename(orderUuid)).toBe(`resultado-laboratorio-${orderUuid}.pdf`);
    expect(() => getLabOrderPdfFilename('../patient-name')).toThrow('persisted order UUID');
  });

  it('reads only the attachment whose namespace and path exactly match the order', async () => {
    const context = getLabOrderPdfContext(order);
    if (!context) {
      throw new Error('Expected a valid test order context');
    }
    mockOpenmrsFetch.mockResolvedValue(
      fetchResponse({
        uuid: encounterUuid,
        patient: { uuid: patientUuid },
        obs: [
          {
            uuid: attachmentUuid,
            formFieldNamespace: context.formFieldNamespace,
            formFieldPath: context.formFieldPath,
          },
          {
            uuid: unrelatedAttachmentUuid,
            formFieldNamespace: context.formFieldNamespace,
            formFieldPath: `${context.formFieldPath}-another-order`,
          },
          {
            uuid: '66666666-6666-6666-6666-666666666666',
            formFieldNamespace: context.formFieldNamespace,
            formFieldPath: context.formFieldPath,
            voided: true,
          },
        ],
      }),
    );
    mockGetAttachmentByUuid.mockResolvedValue(
      fetchResponse({
        bytesContentFamily: 'PDF',
        bytesMimeType: 'application/pdf',
        comment: '',
        dateTime: '2026-08-26T10:00:00.000-05:00',
        filename: 'supplement.pdf',
        uuid: attachmentUuid,
      }),
    );

    await expect(getLabOrderPdfAttachments(order, new AbortController())).resolves.toEqual([
      expect.objectContaining({
        filename: `resultado-laboratorio-${orderUuid}.pdf`,
        uuid: attachmentUuid,
      }),
    ]);
    expect(mockGetAttachmentByUuid).toHaveBeenCalledTimes(1);
    expect(mockGetAttachmentByUuid).toHaveBeenCalledWith(attachmentUuid, expect.any(AbortController));
    expect(context.formFieldNamespace).toBe(LAB_ORDER_PDF_NAMESPACE);
    expect(context.formFieldPath).toContain(orderUuid);
  });

  it('fails closed when the encounter patient does not match the order patient', async () => {
    mockOpenmrsFetch.mockResolvedValue(
      fetchResponse({
        uuid: encounterUuid,
        patient: { uuid: '77777777-7777-7777-7777-777777777777' },
        obs: [],
      }),
    );

    await expect(getLabOrderPdfAttachments(order, new AbortController())).rejects.toThrow('encounter does not belong');
    expect(mockGetAttachmentByUuid).not.toHaveBeenCalled();
  });

  it('fails closed when an associated attachment is not a PDF', async () => {
    const context = getLabOrderPdfContext(order);
    if (!context) {
      throw new Error('Expected a valid test order context');
    }
    mockOpenmrsFetch.mockResolvedValue(
      fetchResponse({
        uuid: encounterUuid,
        patient: { uuid: patientUuid },
        obs: [
          {
            uuid: attachmentUuid,
            formFieldNamespace: context.formFieldNamespace,
            formFieldPath: context.formFieldPath,
          },
        ],
      }),
    );
    mockGetAttachmentByUuid.mockResolvedValue(
      fetchResponse({
        bytesContentFamily: 'IMAGE',
        bytesMimeType: 'image/png',
        comment: '',
        dateTime: '2026-08-26T10:00:00.000-05:00',
        filename: 'not-a-pdf.png',
        uuid: attachmentUuid,
      }),
    );

    await expect(getLabOrderPdfAttachments(order, new AbortController())).rejects.toThrow('not a valid PDF');
  });
});
