import { type AttachmentResponse, getAttachmentByUuid, openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import type { Order } from '@openmrs/esm-patient-common-lib';

export const LAB_ORDER_PDF_NAMESPACE = 'sihsalus-laboratory';
export const LAB_ORDER_PDF_PATH_PREFIX = 'sihsalus-laboratory-order-';
export const LAB_ORDER_PDF_PATH_SUFFIX = '-supplemental-pdf';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const encounterRepresentation = 'custom:(uuid,patient:(uuid),obs:(uuid,voided,formFieldNamespace,formFieldPath))';

type LabOrder = Pick<Order, 'encounter' | 'patient' | 'type' | 'uuid'>;

interface EncounterAttachmentObs {
  formFieldNamespace?: string;
  formFieldPath?: string;
  uuid: string;
  voided?: boolean;
}

interface EncounterAttachmentResponse {
  obs?: Array<EncounterAttachmentObs>;
  patient?: { uuid?: string };
  uuid?: string;
}

export interface LabOrderPdfContext {
  encounterUuid: string;
  formFieldNamespace: string;
  formFieldPath: string;
  orderUuid: string;
  patientUuid: string;
}

export function getLabOrderPdfPath(orderUuid: string): string {
  return `${LAB_ORDER_PDF_PATH_PREFIX}${orderUuid}${LAB_ORDER_PDF_PATH_SUFFIX}`;
}

export function getLabOrderPdfFilename(orderUuid: string): string {
  if (!uuidPattern.test(orderUuid)) {
    throw new Error('A persisted order UUID is required for the laboratory PDF filename.');
  }
  return `resultado-laboratorio-${orderUuid}.pdf`;
}

/** Returns null until the order, encounter, and patient all have persisted UUIDs. */
export function getLabOrderPdfContext(order: LabOrder): LabOrderPdfContext | null {
  const orderUuid = order?.uuid;
  const encounterUuid = order?.encounter?.uuid;
  const patientUuid = order?.patient?.uuid;

  if (
    order?.type?.toLowerCase() !== 'testorder' ||
    !uuidPattern.test(orderUuid) ||
    !uuidPattern.test(encounterUuid) ||
    !uuidPattern.test(patientUuid)
  ) {
    return null;
  }

  return {
    encounterUuid,
    formFieldNamespace: LAB_ORDER_PDF_NAMESPACE,
    formFieldPath: getLabOrderPdfPath(orderUuid),
    orderUuid,
    patientUuid,
  };
}

function isPdfAttachment(attachment: AttachmentResponse): boolean {
  const mimeType = attachment.bytesMimeType?.split(';', 1)[0].trim().toLowerCase();
  return attachment.bytesContentFamily?.toUpperCase() === 'PDF' && mimeType === 'application/pdf';
}

/**
 * Reads only PDF attachments whose encounter observation has the exact
 * namespace/path reserved for this persisted laboratory order.
 */
export async function getLabOrderPdfAttachments(
  order: LabOrder,
  abortController: AbortController,
): Promise<Array<AttachmentResponse>> {
  const context = getLabOrderPdfContext(order);
  if (!context) {
    throw new Error('The laboratory order does not have a valid persisted context.');
  }

  const response = await openmrsFetch<EncounterAttachmentResponse>(
    `${restBaseUrl}/encounter/${encodeURIComponent(context.encounterUuid)}?v=${encodeURIComponent(encounterRepresentation)}`,
    { signal: abortController.signal },
  );
  const encounter = response.data;

  if (encounter.uuid !== context.encounterUuid || encounter.patient?.uuid !== context.patientUuid) {
    throw new Error('The encounter does not belong to the laboratory order patient.');
  }

  const attachmentObsUuids = [
    ...new Set(
      (encounter.obs ?? [])
        .filter(
          (obs) =>
            !obs.voided &&
            uuidPattern.test(obs.uuid) &&
            obs.formFieldNamespace === context.formFieldNamespace &&
            obs.formFieldPath === context.formFieldPath,
        )
        .map((obs) => obs.uuid),
    ),
  ];

  const attachments = await Promise.all(
    attachmentObsUuids.map(async (attachmentUuid) => {
      const attachmentResponse = await getAttachmentByUuid(attachmentUuid, abortController);
      const attachment = attachmentResponse.data as AttachmentResponse;

      if (attachment.uuid !== attachmentUuid || !isPdfAttachment(attachment)) {
        throw new Error('The associated laboratory attachment is not a valid PDF.');
      }

      // Local filenames may contain identifiers. Do not propagate them into
      // the laboratory view state; use the order-scoped generic name instead.
      return {
        bytesContentFamily: attachment.bytesContentFamily,
        bytesMimeType: attachment.bytesMimeType,
        comment: '',
        dateTime: attachment.dateTime,
        filename: getLabOrderPdfFilename(context.orderUuid),
        uuid: attachment.uuid,
      };
    }),
  );

  return attachments.sort((left, right) => Date.parse(right.dateTime) - Date.parse(left.dateTime));
}
