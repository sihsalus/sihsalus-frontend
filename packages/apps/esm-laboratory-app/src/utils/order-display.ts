import type { TFunction } from 'i18next';
import type { FulfillerStatus } from '../types';

const humanizeCode = (value: string) =>
  value
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

export function getFulfillerStatusDisplay(status: FulfillerStatus | undefined, t: TFunction): string {
  if (!status) {
    return t('orderNotPicked', 'Order not picked');
  }

  return t(`fulfillerStatus_${status}`, humanizeCode(status));
}

const priorityLabels: Record<string, string> = {
  'E724BDB6-2C75-4B6F-A00C-D43F2C372974': 'Emergencia',
  'B96959DB-2106-4CE7-B39B-6FCB2CA88CDA': 'Urgente',
  '427A595A-A5EE-4BA7-BCB7-2503248EFB31': 'Urgencia menor',
  'BF3A08C6-CBE6-4F00-8E06-5F5437790B85': 'Rutina',
  '65CF194E-05A7-4832-BA6D-9B7C9940A7C2': 'Programado',
  'STAT': 'Urgente',
  'ROUTINE': 'Rutina',
  'ON_SCHEDULED_DATE': 'Programado',
};

export function getOrderUrgencyDisplay(urgency: string | undefined, t: TFunction): string {
  if (!urgency) {
    return '';
  }

  const normUrgency = urgency.toUpperCase();
  if (priorityLabels[normUrgency]) {
    return t(`priority_${normUrgency}`, priorityLabels[normUrgency]);
  }

  // If urgency is a concept UUID, show as-is (no humanization needed for UUIDs)
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(urgency)) {
    return urgency;
  }

  return t(`orderUrgency_${urgency}`, humanizeCode(urgency));
}
