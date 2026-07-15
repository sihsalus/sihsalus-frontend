import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueueEntries } from '../hooks/useQueueEntries';
import ClearQueueEntries from '../modals/clear-queue-entries-modal/clear-queue-entries.component';
import AddPatientToQueueButton from '../queue-table/components/add-patient-to-queue-button.component';
import { useServiceQueuesStore } from '../store/store';
import styles from './metrics-header.scss';

const MetricsHeader = () => {
  const { t } = useTranslation();
  const { selectedServiceUuid, selectedQueueLocationUuid, selectedQueueStatusUuid } = useServiceQueuesStore();

  const searchCriteria = useMemo(
    () => ({
      service: selectedServiceUuid,
      location: selectedQueueLocationUuid,
      isEnded: false,
      status: selectedQueueStatusUuid,
    }),
    [selectedServiceUuid, selectedQueueLocationUuid, selectedQueueStatusUuid],
  );
  const { queueEntries } = useQueueEntries(searchCriteria);

  return (
    <div className={styles.metricsContainer}>
      <span className={styles.metricsTitle}>{t('clinicMetrics', 'Clinic metrics')}</span>
      <div className={styles.metricsContent}>
        {queueEntries?.length > 0 && <ClearQueueEntries queueEntries={queueEntries} />}
        <AddPatientToQueueButton />
      </div>
    </div>
  );
};

export default MetricsHeader;
