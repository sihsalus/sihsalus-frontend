import { DataTableSkeleton } from '@carbon/react';
import { UserFollow } from '@carbon/react/icons';
import { ErrorState } from '@openmrs/esm-framework';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useEmergencyConfig } from '../../../hooks/use-priority-config';
import { useEmergencyMetrics } from '../../../resources/emergency.resource';
import {
  MetricsCard,
  MetricsCardBody,
  MetricsCardHeader,
  MetricsCardItem,
} from '../../emergency-metrics/metrics-cards/metrics-card.component';

const WaitingTriageCard: React.FC<{ queueUuid?: string }> = ({ queueUuid }) => {
  const { t } = useTranslation();
  const { emergencyTriageQueueUuid } = useEmergencyConfig();
  const { metrics, isLoading, error } = useEmergencyMetrics(
    undefined,
    undefined,
    queueUuid || emergencyTriageQueueUuid,
  );

  if (isLoading) {
    return <DataTableSkeleton role="progressbar" />;
  }

  if (error) {
    return <ErrorState headerTitle={t('errorLoadingMetrics', 'Error loading metrics')} error={error} />;
  }

  return (
    <MetricsCard>
      <MetricsCardHeader title={t('waitingTriage', 'Esperando triaje')} icon={<UserFollow size={24} />} />
      <MetricsCardBody>
        <MetricsCardItem
          label={t('patients', 'pacientes')}
          value={metrics.patientsWithoutTriage}
          color={metrics.patientsWithoutTriage > 0 ? 'orange' : 'default'}
        />
      </MetricsCardBody>
    </MetricsCard>
  );
};

export default WaitingTriageCard;
