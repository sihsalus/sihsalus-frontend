import { LaboratoryPictogram, PageHeader, showSnackbar, useConfig, useDefineAppContext } from '@openmrs/esm-framework';
import dayjs from 'dayjs';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type Config } from './config-schema';
import LaboratoryOrdersTabs from './lab-tabs/laboratory-tabs.component';
import LaboratorySummaryTiles from './lab-tiles/laboratory-summary-tiles.component';
import { useInvalidateLabOrders } from './laboratory.resource';
import styles from './laboratory-dashboard.scss';
import {
  type LaboratoryNotificationEventType,
  labOrderCreatedEventType,
  useLaboratoryNotifications,
} from './laboratory-notifications.resource';
import { type DateFilterContext } from './types';

const LaboratoryDashboard: React.FC = () => {
  const { t } = useTranslation();
  const { enableRealtimeLabResultNotifications } = useConfig<Config>();
  const invalidateLabOrders = useInvalidateLabOrders();
  const [dateRange, setDateRange] = useState<[Date, Date]>([dayjs().startOf('day').toDate(), new Date()]);
  useDefineAppContext<DateFilterContext>('laboratory-date-filter', { dateRange, setDateRange });

  const refreshLaboratoryWorklist = useCallback(() => {
    invalidateLabOrders();
  }, [invalidateLabOrders]);
  const handleNotification = useCallback(
    (eventType: LaboratoryNotificationEventType) => {
      refreshLaboratoryWorklist();
      const orderCreated = eventType === labOrderCreatedEventType;
      showSnackbar({
        isLowContrast: true,
        kind: 'info',
        title: orderCreated
          ? t('labOrderCreated', 'New laboratory order')
          : t('labResultReady', 'Laboratory result available'),
        subtitle: orderCreated
          ? t('labOrderCreatedMessage', 'A new order was added to the laboratory worklist.')
          : t('labResultReadyMessage', 'The laboratory worklist was updated automatically.'),
      });
    },
    [refreshLaboratoryWorklist, t],
  );
  useLaboratoryNotifications(enableRealtimeLabResultNotifications, handleNotification, refreshLaboratoryWorklist);

  return (
    <div>
      <PageHeader
        illustration={<LaboratoryPictogram />}
        title={t('laboratory', 'Laboratory')}
        className={styles.pageHeader}
      />
      <div>
        <LaboratorySummaryTiles />
        <LaboratoryOrdersTabs />
      </div>
    </div>
  );
};

export default LaboratoryDashboard;
