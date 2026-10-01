import { LaboratoryPictogram, PageHeader, showSnackbar, useConfig, useDefineAppContext } from '@openmrs/esm-framework';
import dayjs from 'dayjs';
import React, { useCallback, useEffect, useRef, useState } from 'react';
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

  const enqueueRefresh = useRef<(event?: LaboratoryNotificationEventType) => void>(() => {});
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let dirty = false;
    let inFlight = false;
    let disposed = false;
    let eventCount = 0;
    let firstEvent: LaboratoryNotificationEventType | undefined;
    const schedule = () => {
      if (!disposed && !inFlight && !timer && dirty) {
        timer = setTimeout(flush, 1000);
      }
    };
    const flush = async () => {
      timer = undefined;
      dirty = false;
      inFlight = true;
      const pendingCount = eventCount;
      const orderCreated = firstEvent === labOrderCreatedEventType;
      eventCount = 0;
      firstEvent = undefined;
      try {
        await invalidateLabOrders();
        if (!disposed && pendingCount) {
          showSnackbar({
            isLowContrast: true,
            kind: 'info',
            title:
              pendingCount > 1
                ? t('labWorklistUpdated', 'Laboratory worklist updated')
                : orderCreated
                  ? t('labOrderCreated', 'New laboratory order')
                  : t('labResultReady', 'Laboratory result available'),
            subtitle:
              pendingCount > 1
                ? t('labWorklistUpdatesMessage', '{{count}} notifications were grouped into one refresh.', {
                    count: pendingCount,
                  })
                : orderCreated
                  ? t('labOrderCreatedMessage', 'A new order was added to the laboratory worklist.')
                  : t('labResultReadyMessage', 'The laboratory worklist was updated automatically.'),
          });
        }
      } catch {
        // SWR retains its error and existing rows; another event or focus can retry.
      } finally {
        inFlight = false;
        schedule();
      }
    };
    enqueueRefresh.current = (event) => {
      dirty = true;
      if (event) {
        firstEvent ??= event;
        eventCount++;
      }
      schedule();
    };
    return () => {
      disposed = true;
      clearTimeout(timer);
      enqueueRefresh.current = () => {};
    };
  }, [invalidateLabOrders, t]);
  const refreshLaboratoryWorklist = useCallback(() => enqueueRefresh.current(), []);
  const handleNotification = useCallback((eventType: LaboratoryNotificationEventType) => {
    enqueueRefresh.current(eventType);
  }, []);
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
