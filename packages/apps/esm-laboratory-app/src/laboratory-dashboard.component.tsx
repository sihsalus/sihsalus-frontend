import { LaboratoryPictogram, PageHeader, showSnackbar, useConfig, useDefineAppContext } from '@openmrs/esm-framework';
import dayjs from 'dayjs';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type Config } from './config-schema';
import LaboratoryOrdersTabs from './lab-tabs/laboratory-tabs.component';
import LaboratorySummaryTiles from './lab-tiles/laboratory-summary-tiles.component';
import { useLabResultReadyNotifications } from './laboratory-notifications.resource';
import { useInvalidateLabOrders } from './laboratory.resource';
import styles from './laboratory-dashboard.scss';
import { type DateFilterContext } from './types';

const LaboratoryDashboard: React.FC = () => {
  const { t } = useTranslation();
  const { enableRealtimeLabResultNotifications } = useConfig<Config>();
  const invalidateLabOrders = useInvalidateLabOrders();
  const [dateRange, setDateRange] = useState<[Date, Date]>([dayjs().startOf('day').toDate(), new Date()]);
  useDefineAppContext<DateFilterContext>('laboratory-date-filter', { dateRange, setDateRange });

  const handleResultReady = useCallback(() => {
    invalidateLabOrders();
    showSnackbar({
      isLowContrast: true,
      kind: 'info',
      title: t('labResultReady', 'Laboratory result available'),
      subtitle: t('labResultReadyMessage', 'The laboratory worklist was updated automatically.'),
    });
  }, [invalidateLabOrders, t]);
  useLabResultReadyNotifications(enableRealtimeLabResultNotifications, handleResultReady);

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
