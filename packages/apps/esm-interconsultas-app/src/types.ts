export type FulfillerStatus = 'RECEIVED' | 'IN_PROGRESS' | 'EXCEPTION' | 'ON_HOLD' | 'DECLINED' | 'COMPLETED';

/**
 * Estados normativos de la interconsulta. Se derivan del estado de la orden,
 * no se persisten por separado (ver README — contrato backend):
 * - REQUESTED:   orden NEW sin fulfillerStatus (Solicitada)
 * - RECEIVED:    Recibida / Pendiente
 * - IN_PROGRESS: En atención
 * - COMPLETED:   Respondida / Completada
 * - DECLINED:    Rechazada
 * - CANCELLED:   orden descontinuada/anulada por el solicitante (Cancelada)
 */
export type InterconsultaStatus = 'REQUESTED' | FulfillerStatus | 'CANCELLED';

/** Filtros de bandeja: cada tab corresponde a uno de estos grupos. */
export type InterconsultaTrayFilter = 'REQUESTED' | 'RECEIVED' | 'IN_PROGRESS' | 'COMPLETED' | 'CLOSED';

export interface OpenmrsRef {
  uuid: string;
  display?: string;
}

/**
 * Representación de la interconsulta. Todos los datos del paciente, visita,
 * profesional y location son referencias a recursos existentes; los únicos
 * datos propios son motivo (instructions), prioridad (urgency), servicio
 * destino (concept), fechas y estado (fulfillerStatus/fulfillerComment).
 */
export interface InterconsultaOrder {
  uuid: string;
  orderNumber: string;
  action: 'NEW' | 'REVISE' | 'DISCONTINUE' | 'RENEW';
  dateActivated: string;
  dateStopped: string | null;
  autoExpireDate: string | null;
  scheduledDate: string | null;
  urgency: 'ROUTINE' | 'STAT' | 'ON_SCHEDULED_DATE';
  instructions: string | null;
  fulfillerStatus: FulfillerStatus | null;
  fulfillerComment: string | null;
  concept: OpenmrsRef;
  patient: OpenmrsRef;
  orderer: OpenmrsRef | null;
  encounter: {
    uuid: string;
    location?: OpenmrsRef | null;
    visit?: { uuid: string } | null;
  };
}

export interface InterconsultaResponseObs {
  uuid: string;
  obsDatetime: string;
  value: string | { display?: string };
  concept: OpenmrsRef;
  order?: { uuid: string } | null;
  auditInfo?: {
    creator?: { display?: string };
  };
}

export interface OrderableService {
  uuid: string;
  display: string;
}
