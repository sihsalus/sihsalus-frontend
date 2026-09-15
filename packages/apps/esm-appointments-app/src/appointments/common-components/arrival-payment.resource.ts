import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';

export const ARRIVAL_PAYMENT_CONFIGURATION_MISSING = 'ARRIVAL_PAYMENT_CONFIGURATION_MISSING';
export const ARRIVAL_PAYMENT_NOT_SAVED = 'ARRIVAL_PAYMENT_NOT_SAVED';

export interface ArrivalPaymentConfirmation {
  version: 1;
  confirmed: true;
  financingUuid: string;
  appointmentUuid: string;
  confirmedBy: string;
  confirmedAt: string;
}

interface PaymentAttribute {
  uuid: string;
  attributeType: { uuid: string };
  value: string;
  voided?: boolean;
}

export async function assertArrivalPaymentAttributeConfigured(attributeTypeUuid: string) {
  if (!attributeTypeUuid) {
    throw Object.assign(new Error('Payment attribute is not configured'), {
      code: ARRIVAL_PAYMENT_CONFIGURATION_MISSING,
    });
  }
  const { data } = await openmrsFetch<{ retired?: boolean; datatypeClassname: string }>(
    `${restBaseUrl}/visitattributetype/${attributeTypeUuid}?v=full`,
  ).catch((cause) => {
    throw Object.assign(new Error('Payment attribute metadata could not be loaded', { cause }), {
      code: ARRIVAL_PAYMENT_CONFIGURATION_MISSING,
    });
  });
  if (data.retired || data.datatypeClassname !== 'org.openmrs.customdatatype.datatype.FreeTextDatatype') {
    throw Object.assign(new Error('Payment attribute is not compatible'), {
      code: ARRIVAL_PAYMENT_CONFIGURATION_MISSING,
    });
  }
}

export async function ensureArrivalPaymentSaved(
  visitUuid: string,
  attributeTypeUuid: string,
  confirmation: ArrivalPaymentConfirmation,
) {
  const url = `${restBaseUrl}/visit/${visitUuid}/attribute`;
  const read = async () => {
    const { data } = await openmrsFetch<{ results: PaymentAttribute[] }>(
      `${url}?v=custom:(uuid,attributeType:(uuid),value,voided)`,
      { cache: 'no-store' },
    );
    return data.results.filter((attribute) => !attribute.voided && attribute.attributeType.uuid === attributeTypeUuid);
  };
  const value = JSON.stringify(confirmation);
  const matches = (attributes: PaymentAttribute[]) => attributes.some((attribute) => attribute.value === value);
  const existing = await read();
  if (matches(existing)) return;
  try {
    await openmrsFetch(existing[0] ? `${url}/${existing[0].uuid}` : url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { attributeType: attributeTypeUuid, value },
    });
  } catch (error) {
    // A lost response may follow a successful write. Read back before retrying.
    if (matches(await read())) return;
    throw error;
  }
  if (!matches(await read())) {
    throw Object.assign(new Error('Payment confirmation was not persisted'), { code: ARRIVAL_PAYMENT_NOT_SAVED });
  }
}
