import { InlineNotification } from '@carbon/react';
import { useConfig } from '@openmrs/esm-framework';
import { useTranslation } from 'react-i18next';
import { type ConfigObject } from '../../config-schema';
import { formatAverageWaitTime } from '../../helpers/format-average-wait-time';
import { getQueueEntryDateCriteria } from '../../store/queue-entry-date';
import { useServiceQueuesStore } from '../../store/store';
import { useAverageWaitTime } from '../metrics.resource';
import { MetricsCard, MetricsCardBody, MetricsCardHeader, MetricsCardItem } from './metrics-card.component';

export default function AverageWaitTimeExtension() {
  const { t, i18n } = useTranslation();
  const { selectedServiceUuid, selectedQueueEntryDate } = useServiceQueuesStore();
  const {
    concepts: { defaultStatusConceptUuid },
  } = useConfig<ConfigObject>();
  const { waitTime, isLoading, error } = useAverageWaitTime(selectedServiceUuid, defaultStatusConceptUuid, {
    ...getQueueEntryDateCriteria(selectedQueueEntryDate),
  });

  return (
    <MetricsCard>
      <MetricsCardHeader
        title={
          selectedServiceUuid
            ? t('averageServiceWaitAllUpss', 'Average service wait · all UPSS')
            : t('averageQueueWaitAllUpss', 'Average queue wait · all UPSS')
        }
      />
      <p>{t('averageWaitScope', 'UPSS filters the list and waiting count. This average includes all UPSS.')}</p>
      <MetricsCardBody>
        <MetricsCardItem
          label={t('minutes', 'Minutes')}
          value={!isLoading && !error ? formatAverageWaitTime(waitTime?.averageWaitTime, i18n.language) : '--'}
        />
      </MetricsCardBody>
      {error && (
        <InlineNotification
          kind="error"
          hideCloseButton
          title={t('queueMetricsUnavailable', 'Queue metrics could not be loaded')}
        />
      )}
    </MetricsCard>
  );
}
