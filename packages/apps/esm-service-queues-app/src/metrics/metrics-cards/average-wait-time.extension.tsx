import { useConfig } from '@openmrs/esm-framework';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { type ConfigObject } from '../../config-schema';
import { useServiceQueuesStore } from '../../store/store';
import { useAverageWaitTime } from '../metrics.resource';
import { MetricsCard, MetricsCardBody, MetricsCardHeader, MetricsCardItem } from './metrics-card.component';

export default function AverageWaitTimeExtension() {
  const { t } = useTranslation();
  const { selectedServiceUuid } = useServiceQueuesStore();
  const {
    concepts: { defaultStatusConceptUuid },
  } = useConfig<ConfigObject>();
  const { waitTime } = useAverageWaitTime(selectedServiceUuid, defaultStatusConceptUuid);

  return (
    <MetricsCard>
      <MetricsCardHeader title={t('averageWaitTime', 'Average wait time today')} />
      <MetricsCardBody>
        <MetricsCardItem label={t('minutes', 'Minutes')} value={waitTime ? waitTime.averageWaitTime : '--'} />
      </MetricsCardBody>
    </MetricsCard>
  );
}
