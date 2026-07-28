/**
 * Emergency Dashboard Component
 *
 * Main dashboard for the emergency department with improved UX:
 * - Alert banners for critical patients and pending triage
 * - Priority level cards (4 horizontal cards)
 * - Compact metrics (Total, Waiting, Avg Wait)
 * - Search and filters bar
 * - Patient queue table
 *
 * Follows OpenMRS patterns:
 * - Uses ExtensionSlot for extensible components
 * - Uses SWR hooks for data fetching
 * - Implements proper loading and error states
 * - Uses Carbon Design System components
 */

import { Dropdown } from '@carbon/react';
import { WorkspaceContainer } from '@openmrs/esm-framework';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ErrorBoundary from '../error-boundary.component';
import { useEmergencyConfig } from '../hooks/use-priority-config';
import CompactMetricsContainer from './compact-metrics/compact-metrics-container.component';
import EmergencyAlerts from './emergency-alerts/emergency-alerts.component';
import styles from './emergency-dashboard.scss';
import EmergencyHeader from './emergency-header/emergency-header.component';
import EmergencyQueueTable from './emergency-queue-table/emergency-queue-table.component';
import PriorityLevelCardsContainer from './priority-level-cards/priority-level-cards-container.component';
import TriageClassificationCards from './priority-level-cards/triage-classification-cards.component';

interface QueueFilterItem {
  id: string;
  text: string;
  queueUuid?: string;
}

const EmergencyDashboardContent: React.FC = () => {
  const { t } = useTranslation();
  const emergencyConfig = useEmergencyConfig();

  const queueFilterItems: QueueFilterItem[] = useMemo(
    () => [
      {
        id: 'triage',
        text: t('triageQueue', 'Cola de Triaje'),
        queueUuid: emergencyConfig.emergencyTriageQueueUuid,
      },
      {
        id: 'attention',
        text: t('attentionQueue', 'Cola de Atención'),
        queueUuid: emergencyConfig.emergencyAttentionQueueUuid,
      },
    ],
    [t, emergencyConfig],
  );

  const [selectedQueueFilter, setSelectedQueueFilter] = useState<QueueFilterItem>(queueFilterItems[0]);
  const activeQueueUuid = selectedQueueFilter?.queueUuid;

  const queueFilterDropdown = (
    <Dropdown
      id="queue-filter"
      titleText=""
      label={t('selectQueue', 'Seleccionar cola')}
      items={queueFilterItems}
      itemToString={(item: QueueFilterItem) => item?.text ?? ''}
      selectedItem={selectedQueueFilter}
      onChange={({ selectedItem }) => {
        if (selectedItem) setSelectedQueueFilter(selectedItem);
      }}
      size="sm"
      className={styles.queueFilterDropdown}
    />
  );

  return (
    <div className={styles.dashboardContainer}>
      <main className={styles.dashboard}>
        <EmergencyHeader queueFilter={queueFilterDropdown} />
        <EmergencyAlerts />
        {selectedQueueFilter.id === 'triage' ? (
          <TriageClassificationCards queueUuid={activeQueueUuid} />
        ) : (
          <PriorityLevelCardsContainer queueUuid={activeQueueUuid} />
        )}
        <CompactMetricsContainer queueUuid={activeQueueUuid} />
        <EmergencyQueueTable queueUuid={activeQueueUuid} />
      </main>
      <WorkspaceContainer contextKey="emergency" />
    </div>
  );
};

const EmergencyDashboard: React.FC = () => (
  <ErrorBoundary>
    <EmergencyDashboardContent />
  </ErrorBoundary>
);

export default EmergencyDashboard;
