import { openmrsFetch, restBaseUrl, showSnackbar } from '@openmrs/esm-framework';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import type { Order } from '../types';

type EncounterOrdersResponse = {
  orders?: Array<Pick<Order, 'auditInfo' | 'display' | 'orderNumber'>>;
};

/**
 * Shows a snackbar notification listing lab orders that were submitted
 * as part of a form encounter.
 */
export function useLabOrderNotification() {
  const { t } = useTranslation();

  const showLabOrdersNotification = useCallback(
    async (encounterUuid: string) => {
      if (!encounterUuid) return;

      try {
        const response = await openmrsFetch<EncounterOrdersResponse>(
          `${restBaseUrl}/encounter/${encounterUuid}?v=custom:(uuid,orders:(uuid,display,orderNumber,auditInfo:(dateVoided)))`,
        );

        const orders = response.data.orders?.filter((order) => !order.auditInfo?.dateVoided);

        if (orders?.length) {
          const orderList = orders.map((order, i) => `${i + 1}. ${order.display} (${order.orderNumber})`).join(', ');

          showSnackbar({
            title: t('labOrdersGenerated', 'Lab order(s) generated'),
            subtitle: orderList,
            kind: 'success',
            isLowContrast: true,
          });
        }
      } catch (error) {
        console.error('Failed to fetch lab orders for notification:', error);
      }
    },
    [t],
  );

  return { showLabOrdersNotification };
}
