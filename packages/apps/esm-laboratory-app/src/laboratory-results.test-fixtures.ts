import type { LabResultObservation } from './laboratory-results.resource';
import type { Order } from './types';

export const resultOrder = {
  uuid: 'synthetic-order-1',
  orderNumber: 'SYN-LAB-001',
  action: 'NEW',
  fulfillerStatus: 'COMPLETED',
  patient: { uuid: 'synthetic-patient', display: 'SYN-001 - Paciente de prueba' },
  encounter: { uuid: 'synthetic-encounter', visit: { uuid: 'synthetic-visit' } },
  concept: { uuid: 'synthetic-test', display: 'Prueba sintética' },
} as Order;

export const resultObservation: LabResultObservation = {
  uuid: 'synthetic-observation',
  person: { uuid: resultOrder.patient.uuid },
  encounter: { uuid: resultOrder.encounter.uuid },
  order: { uuid: resultOrder.uuid },
  concept: { uuid: resultOrder.concept.uuid, display: 'Prueba sintética', units: 'mg/dL' },
  obsDatetime: '2026-09-21T10:00:00.000-0500',
  voided: false,
  value: 0,
  referenceRange: { lowNormal: 0, hiNormal: 20 },
  comment: 'Comentario sintético',
};
