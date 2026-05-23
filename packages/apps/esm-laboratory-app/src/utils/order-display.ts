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

export function getOrderUrgencyDisplay(urgency: string | undefined, t: TFunction): string {
  if (!urgency) {
    return '';
  }

  // If urgency is a concept UUID, show as-is (no humanization needed for UUIDs)
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-/.test(urgency)) {
    return urgency;
  }

  return t(`orderUrgency_${urgency}`, humanizeCode(urgency));
}
