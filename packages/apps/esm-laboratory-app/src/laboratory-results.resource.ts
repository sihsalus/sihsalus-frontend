import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import type { Order } from './types';

export interface LabResultObservation {
  uuid: string;
  person: { uuid: string };
  encounter: { uuid: string };
  order?: { uuid: string } | null;
  concept: { uuid: string; display: string; units?: string };
  obsDatetime: string;
  voided: boolean;
  value?: string | number | { uuid: string; display: string } | null;
  valueModifier?: string | null;
  comment?: string | null;
  referenceRange?: { lowNormal?: number | null; hiNormal?: number | null } | null;
  groupMembers?: Array<LabResultObservation> | null;
}

export interface LabOrderResult {
  order: Order;
  observation: LabResultObservation;
}

export function getResultPatientUuid(orders: Array<Order>): string | null {
  const patientUuid = orders[0]?.patient?.uuid;
  return patientUuid &&
    orders.every((order) => order.uuid && order.patient?.uuid === patientUuid && order.encounter?.uuid)
    ? patientUuid
    : null;
}

const orderRepresentation =
  'custom:(uuid,voided,orderNumber,action,fulfillerStatus,concept:(uuid,display),' +
  'patient:(uuid,display,person:(uuid,display)),encounter:(uuid,visit:(uuid)))';
const encounterRepresentation = 'custom:(uuid,patient:(uuid),obs:(uuid,voided,obsGroup:(uuid),order:(uuid)))';

interface ResultEncounter {
  uuid: string;
  patient: { uuid: string };
  obs: Array<{ uuid: string; voided: boolean; obsGroup?: { uuid: string } | null; order?: { uuid: string } | null }>;
}

// Read by persisted IDs, never by ambient patient context or the test's concept alone.
export async function fetchLabOrderResult(
  selectedOrder: Order,
  allowedStatuses: Array<Order['fulfillerStatus']>,
  signal?: AbortSignal,
): Promise<LabOrderResult> {
  if (!getResultPatientUuid([selectedOrder])) throw new Error('Invalid laboratory result selection');

  const { data: order } = await openmrsFetch<Order>(
    `${restBaseUrl}/order/${encodeURIComponent(selectedOrder.uuid)}?v=${orderRepresentation}`,
    { signal },
  );
  if (
    order.uuid !== selectedOrder.uuid ||
    order.patient?.uuid !== selectedOrder.patient.uuid ||
    order.encounter?.uuid !== selectedOrder.encounter?.uuid ||
    order.concept?.uuid !== selectedOrder.concept?.uuid ||
    order.voided ||
    order.action === 'DISCONTINUE' ||
    !allowedStatuses.includes(order.fulfillerStatus)
  )
    throw new Error('Laboratory order is no longer eligible');

  const { data: encounter } = await openmrsFetch<ResultEncounter>(
    `${restBaseUrl}/encounter/${encodeURIComponent(order.encounter.uuid)}?v=${encounterRepresentation}`,
    { signal },
  );
  if (encounter.uuid !== order.encounter.uuid || encounter.patient?.uuid !== order.patient.uuid) {
    throw new Error('Laboratory encounter does not match the selection');
  }
  const observations = encounter.obs.filter((obs) => !obs.voided && !obs.obsGroup && obs.order?.uuid === order.uuid);
  if (observations.length !== 1) throw new Error('A unique saved laboratory result is required');

  const { data: observation } = await openmrsFetch<LabResultObservation>(
    `${restBaseUrl}/obs/${encodeURIComponent(observations[0].uuid)}?v=full`,
    { signal },
  );
  if (
    observation.uuid !== observations[0].uuid ||
    observation.order?.uuid !== order.uuid ||
    observation.concept?.uuid !== order.concept?.uuid
  ) {
    throw new Error('Laboratory observation does not match the order');
  }
  validateObservation(observation, order);
  return { order, observation };
}

function validateObservation(observation: LabResultObservation, order: Order) {
  if (
    !observation.uuid ||
    observation.voided ||
    !observation.concept?.uuid ||
    observation.person?.uuid !== order.patient.uuid ||
    observation.encounter?.uuid !== order.encounter.uuid ||
    (observation.order && observation.order.uuid !== order.uuid)
  )
    throw new Error('Laboratory result association is invalid');

  const members = observation.groupMembers?.filter((member) => !member.voided);
  if (members?.length) {
    members.forEach((member) => {
      validateObservation(member, order);
    });
  } else if (
    observation.value == null ||
    observation.value === '' ||
    (typeof observation.value === 'object' && !observation.value.display)
  ) {
    throw new Error('Laboratory result has no printable value');
  }
}

export async function fetchLabOrderResults(orders: Array<Order>, signal?: AbortSignal) {
  if (!getResultPatientUuid(orders)) throw new Error('Select laboratory orders for one patient');
  const uniqueOrders = [...new Map(orders.map((order) => [order.uuid, order])).values()];
  return Promise.all(uniqueOrders.map((order) => fetchLabOrderResult(order, ['COMPLETED'], signal)));
}
