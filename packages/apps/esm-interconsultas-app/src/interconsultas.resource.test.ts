import { describe, expect, it } from 'vitest';
import {
  buildResponseObsPayload,
  deriveStatus,
  interconsultaOrdersUrl,
  matchesTrayFilter,
} from './interconsultas.resource';
import type { InterconsultaOrder } from './types';

function makeOrder(overrides: Partial<InterconsultaOrder> = {}): InterconsultaOrder {
  return {
    uuid: 'order-uuid',
    orderNumber: 'ORD-1',
    action: 'NEW',
    dateActivated: '2026-06-01T10:00:00.000Z',
    dateStopped: null,
    autoExpireDate: null,
    scheduledDate: null,
    urgency: 'ROUTINE',
    instructions: 'Evaluación por cardiología',
    fulfillerStatus: null,
    fulfillerComment: null,
    concept: { uuid: 'concept-uuid', display: 'Cardiología' },
    patient: { uuid: 'patient-uuid', display: 'Paciente Prueba' },
    orderer: { uuid: 'provider-uuid', display: 'Doctor A' },
    encounter: {
      uuid: 'encounter-uuid',
      location: { uuid: 'location-uuid', display: 'Consultorio 1' },
      visit: { uuid: 'visit-uuid' },
    },
    ...overrides,
  };
}

describe('deriveStatus', () => {
  it('deriva Solicitada para órdenes nuevas sin fulfillerStatus', () => {
    expect(deriveStatus(makeOrder())).toBe('REQUESTED');
  });

  it('mapea el fulfillerStatus directamente cuando existe', () => {
    expect(deriveStatus(makeOrder({ fulfillerStatus: 'RECEIVED' }))).toBe('RECEIVED');
    expect(deriveStatus(makeOrder({ fulfillerStatus: 'IN_PROGRESS' }))).toBe('IN_PROGRESS');
    expect(deriveStatus(makeOrder({ fulfillerStatus: 'COMPLETED' }))).toBe('COMPLETED');
    expect(deriveStatus(makeOrder({ fulfillerStatus: 'DECLINED' }))).toBe('DECLINED');
  });

  it('deriva Cancelada cuando la orden fue descontinuada sin respuesta', () => {
    expect(deriveStatus(makeOrder({ dateStopped: '2026-06-02T10:00:00.000Z' }))).toBe('CANCELLED');
    expect(deriveStatus(makeOrder({ dateStopped: '2026-06-02T10:00:00.000Z', fulfillerStatus: 'RECEIVED' }))).toBe(
      'CANCELLED',
    );
  });

  it('mantiene Respondida/Rechazada aunque la orden esté detenida', () => {
    expect(deriveStatus(makeOrder({ dateStopped: '2026-06-02T10:00:00.000Z', fulfillerStatus: 'COMPLETED' }))).toBe(
      'COMPLETED',
    );
    expect(deriveStatus(makeOrder({ dateStopped: '2026-06-02T10:00:00.000Z', fulfillerStatus: 'DECLINED' }))).toBe(
      'DECLINED',
    );
  });
});

describe('matchesTrayFilter', () => {
  it('clasifica cada estado en su bandeja', () => {
    expect(matchesTrayFilter(makeOrder(), 'REQUESTED')).toBe(true);
    expect(matchesTrayFilter(makeOrder({ fulfillerStatus: 'RECEIVED' }), 'RECEIVED')).toBe(true);
    expect(matchesTrayFilter(makeOrder({ fulfillerStatus: 'IN_PROGRESS' }), 'IN_PROGRESS')).toBe(true);
    expect(matchesTrayFilter(makeOrder({ fulfillerStatus: 'COMPLETED' }), 'COMPLETED')).toBe(true);
    expect(matchesTrayFilter(makeOrder({ fulfillerStatus: 'DECLINED' }), 'CLOSED')).toBe(true);
    expect(matchesTrayFilter(makeOrder({ dateStopped: '2026-06-02T10:00:00.000Z' }), 'CLOSED')).toBe(true);
  });

  it('no mezcla bandejas', () => {
    expect(matchesTrayFilter(makeOrder({ fulfillerStatus: 'RECEIVED' }), 'REQUESTED')).toBe(false);
    expect(matchesTrayFilter(makeOrder(), 'CLOSED')).toBe(false);
    expect(matchesTrayFilter(makeOrder({ fulfillerStatus: 'COMPLETED' }), 'IN_PROGRESS')).toBe(false);
  });

  it('agrupa ON_HOLD y EXCEPTION con las recibidas/pendientes', () => {
    expect(matchesTrayFilter(makeOrder({ fulfillerStatus: 'ON_HOLD' }), 'RECEIVED')).toBe(true);
    expect(matchesTrayFilter(makeOrder({ fulfillerStatus: 'EXCEPTION' }), 'RECEIVED')).toBe(true);
  });

  it('excluye las órdenes DISCONTINUE (registro de cancelación, no solicitud)', () => {
    expect(matchesTrayFilter(makeOrder({ action: 'DISCONTINUE' }), 'REQUESTED')).toBe(false);
    expect(matchesTrayFilter(makeOrder({ action: 'DISCONTINUE' }), 'CLOSED')).toBe(false);
  });
});

describe('buildResponseObsPayload', () => {
  const order = makeOrder();

  it('liga la obs de respuesta a la orden', () => {
    const payload = buildResponseObsPayload({
      order,
      respuesta: 'Se evaluó al paciente.',
      respuestaConceptUuid: 'respuesta-concept',
    });

    expect(payload.obs).toEqual([
      {
        concept: 'respuesta-concept',
        value: 'Se evaluó al paciente.',
        order: { uuid: order.uuid },
      },
    ]);
  });

  it('crea obs separada de recomendaciones cuando hay concept configurado', () => {
    const payload = buildResponseObsPayload({
      order,
      respuesta: 'Se evaluó al paciente.',
      recomendaciones: 'Control en 30 días.',
      respuestaConceptUuid: 'respuesta-concept',
      recomendacionesConceptUuid: 'recomendaciones-concept',
    });

    expect(payload.obs).toHaveLength(2);
    expect(payload.obs[1]).toEqual({
      concept: 'recomendaciones-concept',
      value: 'Control en 30 días.',
      order: { uuid: order.uuid },
    });
  });

  it('anexa las recomendaciones a la respuesta cuando no hay concept configurado', () => {
    const payload = buildResponseObsPayload({
      order,
      respuesta: 'Se evaluó al paciente.',
      recomendaciones: 'Control en 30 días.',
      respuestaConceptUuid: 'respuesta-concept',
    });

    expect(payload.obs).toHaveLength(1);
    expect(payload.obs[0].value).toBe('Se evaluó al paciente.\n\nRecomendaciones: Control en 30 días.');
  });
});

describe('interconsultaOrdersUrl', () => {
  it('consulta por order type con representación custom', () => {
    const url = interconsultaOrdersUrl('order-type-uuid');
    expect(url).toContain('/order?orderTypes=order-type-uuid');
    expect(url).toContain('v=custom:');
    expect(url).not.toContain('patient=');
  });

  it('agrega el filtro de paciente cuando se pide', () => {
    expect(interconsultaOrdersUrl('order-type-uuid', 'patient-uuid')).toContain('&patient=patient-uuid');
  });
});
