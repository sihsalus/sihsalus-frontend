import { DataTableSkeleton } from '@carbon/react';
import { Timer } from '@carbon/react/icons';
import { ErrorState } from '@openmrs/esm-framework';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useAverageWaitTimeByPriority } from '../../../resources/emergency.resource';
import {
  MetricsCard,
  MetricsCardBody,
  MetricsCardHeader,
  MetricsCardItem,
} from '../../emergency-metrics/metrics-cards/metrics-card.component';

const AvgWaitTimeCard: React.FC<{ queueUuid?: string }> = ({ queueUuid }) => {
  const { t } = useTranslation();
  const { averages, isLoading, error } = useAverageWaitTimeByPriority(undefined, undefined, queueUuid);

  if (isLoading) {
    return <DataTableSkeleton role="progressbar" />;
  }

  if (error) {
    return <ErrorState headerTitle={t('errorLoadingWaitTime', 'Error loading wait time')} error={error} />;
  }

  const formatWaitTime = (minutes: number | null) => {
    if (minutes === null) return '--';
    if (minutes < 60) return `${minutes} ${t('minutes', 'min')}`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}${t('minutes', 'min')}`;
  };

  return (
    <MetricsCard>
      <MetricsCardHeader title={t('avgWaitTime', 'Tiempo prom. espera')} icon={<Timer size={24} />} />
      <MetricsCardBody>
        <MetricsCardItem label={t('time', 'Tiempo')} value={formatWaitTime(averages.overall)} />
      </MetricsCardBody>
    </MetricsCard>
  );
};

export default AvgWaitTimeCard;
