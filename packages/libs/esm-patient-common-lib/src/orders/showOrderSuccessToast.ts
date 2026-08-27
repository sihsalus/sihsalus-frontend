import { showSnackbar, translateFrom } from '@openmrs/esm-framework';

import { type OrderBasketItem } from './types';

type SuccessAction = 'placed' | 'updated' | 'discontinued';

function getNotificationTitle(
  moduleName: string,
  placedOrders: Array<OrderBasketItem>,
  updatedOrders: Array<OrderBasketItem>,
  discontinuedOrders: Array<OrderBasketItem>,
  activeActions: Array<SuccessAction>,
): string {
  if (activeActions.length > 1) {
    return translateFrom(moduleName, 'ordersCompleted', 'Orders completed');
  }

  const action = activeActions[0];

  if (action === 'placed') {
    return placedOrders.length === 1
      ? translateFrom(moduleName, 'orderPlaced', 'Order placed')
      : translateFrom(moduleName, 'ordersPlaced', 'Orders placed');
  }

  if (action === 'updated') {
    return updatedOrders.length === 1
      ? translateFrom(moduleName, 'orderUpdated', 'Order updated')
      : translateFrom(moduleName, 'ordersUpdated', 'Orders updated');
  }

  return discontinuedOrders.length === 1
    ? translateFrom(moduleName, 'orderDiscontinued', 'Order discontinued')
    : translateFrom(moduleName, 'ordersDiscontinued', 'Orders discontinued');
}

export function showOrderSuccessToast(moduleName: string, patientOrderItems: Array<OrderBasketItem>) {
  if (patientOrderItems.length === 0) {
    return;
  }

  const placedOrders = patientOrderItems.filter((item) => ['NEW', 'RENEW'].includes(item.action));
  const updatedOrders = patientOrderItems.filter((item) => item.action === 'REVISE');
  const discontinuedOrders = patientOrderItems.filter((item) => item.action === 'DISCONTINUE');

  const orderedString = placedOrders.map((item) => item.display).join(', ');
  const updatedString = updatedOrders.map((item) => item.display).join(', ');
  const discontinuedString = discontinuedOrders.map((item) => item.display).join(', ');
  const activeActions = [
    orderedString && 'placed',
    updatedString && 'updated',
    discontinuedString && 'discontinued',
  ].filter(Boolean) as Array<SuccessAction>;
  const subtitleParts = [
    orderedString && `${translateFrom(moduleName, 'orderedFor', 'Placed order for')} ${orderedString}.`,
    updatedString && `${translateFrom(moduleName, 'updated', 'Updated')} ${updatedString}.`,
    discontinuedString && `${translateFrom(moduleName, 'discontinued', 'Discontinued')} ${discontinuedString}.`,
  ].filter(Boolean);
  const details = [
    placedOrders.length && {
      title: translateFrom(moduleName, 'orderedFor', 'Placed order for'),
      items: placedOrders.map((item) => item.display),
    },
    updatedOrders.length && {
      title: translateFrom(moduleName, 'updated', 'Updated'),
      items: updatedOrders.map((item) => item.display),
    },
    discontinuedOrders.length && {
      title: translateFrom(moduleName, 'discontinued', 'Discontinued'),
      items: discontinuedOrders.map((item) => item.display),
    },
  ].filter(Boolean) as Array<{ title: string; items: Array<string> }>;

  showSnackbar({
    details,
    isLowContrast: true,
    kind: 'success',
    title: getNotificationTitle(moduleName, placedOrders, updatedOrders, discontinuedOrders, activeActions),
    subtitle: subtitleParts.join(' '),
  } as any);
}
