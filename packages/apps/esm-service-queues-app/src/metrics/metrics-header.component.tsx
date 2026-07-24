import { Button } from '@carbon/react';
import { ChartRelationship } from '@carbon/react/icons';
import { isDesktop, navigate, useLayoutType } from '@openmrs/esm-framework';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { serviceQueuesBasePath } from '../constants';
import { useQueueEntries } from '../hooks/useQueueEntries';
import ClearQueueEntries from '../modals/clear-queue-entries-modal/clear-queue-entries.component';
import AddPatientToQueueButton from '../queue-table/components/add-patient-to-queue-button.component';
import { useServiceQueuesStore } from '../store/store';
import styles from './metrics-header.scss';

const MetricsHeader = () => {
  const { t } = useTranslation();
  const layout = useLayoutType();
  const { selectedServiceUuid, selectedQueueLocationUuid } = useServiceQueuesStore();

  const searchCriteria = useMemo(
    () => ({
      service: selectedServiceUuid,
      location: selectedQueueLocationUuid,
      isEnded: false,
    }),
    [selectedServiceUuid, selectedQueueLocationUuid],
  );
  const { queueEntries } = useQueueEntries(searchCriteria);

  return (
    <div className={styles.metricsContainer}>
      <span className={styles.metricsTitle}>{t('clinicMetrics', 'Queue service metrics')}</span>
      <div className={styles.metricsContent}>
        <Button
          kind="tertiary"
          renderIcon={ChartRelationship}
          size={isDesktop(layout) ? 'sm' : 'md'}
          onClick={() => navigate({ to: `${serviceQueuesBasePath}/visual` })}
        >
          {t('visualQueue', 'Visual queue')}
        </Button>
        <ClearQueueEntries queueEntries={queueEntries} />
        <AddPatientToQueueButton />
      </div>
    </div>
  );
};

export default MetricsHeader;
