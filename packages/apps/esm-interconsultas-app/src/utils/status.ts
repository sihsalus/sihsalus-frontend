import type { InterconsultaStatus } from '../types';

type TFunction = (key: string, defaultValue: string) => string;

export type StatusTagType =
  | 'blue'
  | 'cyan'
  | 'gray'
  | 'green'
  | 'magenta'
  | 'purple'
  | 'red'
  | 'teal'
  | 'warm-gray'
  | 'cool-gray'
  | 'high-contrast'
  | 'outline';

export function getStatusDisplay(status: InterconsultaStatus, t: TFunction): string {
  switch (status) {
    case 'REQUESTED':
      return t('statusRequested', 'Solicitada');
    case 'RECEIVED':
      return t('statusReceived', 'Recibida / Pendiente');
    case 'IN_PROGRESS':
      return t('statusInProgress', 'En atención');
    case 'COMPLETED':
      return t('statusCompleted', 'Respondida');
    case 'DECLINED':
      return t('statusDeclined', 'Rechazada');
    case 'CANCELLED':
      return t('statusCancelled', 'Cancelada');
    case 'ON_HOLD':
      return t('statusOnHold', 'En espera');
    case 'EXCEPTION':
      return t('statusException', 'Observada');
    default:
      return status;
  }
}

export function getStatusTagType(status: InterconsultaStatus): StatusTagType {
  switch (status) {
    case 'REQUESTED':
      return 'blue';
    case 'RECEIVED':
      return 'cyan';
    case 'IN_PROGRESS':
      return 'purple';
    case 'COMPLETED':
      return 'green';
    case 'DECLINED':
      return 'red';
    case 'CANCELLED':
      return 'gray';
    case 'ON_HOLD':
      return 'warm-gray';
    case 'EXCEPTION':
      return 'magenta';
    default:
      return 'gray';
  }
}

export function getUrgencyDisplay(urgency: 'ROUTINE' | 'STAT' | 'ON_SCHEDULED_DATE', t: TFunction): string {
  switch (urgency) {
    case 'STAT':
      return t('urgencyStat', 'Urgente');
    case 'ON_SCHEDULED_DATE':
      return t('urgencyScheduled', 'Programada');
    default:
      return t('urgencyRoutine', 'Rutina');
  }
}
