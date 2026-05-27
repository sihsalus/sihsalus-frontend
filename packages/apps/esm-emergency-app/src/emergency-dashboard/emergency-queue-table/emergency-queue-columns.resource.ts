import { useTranslation } from 'react-i18next';
import { type EmergencyQueueEntry } from '../../resources/emergency.resource';
import { EmergencyQueueActionsCell } from './cells/emergency-queue-actions-cell.component';
import { EmergencyQueueNameCell } from './cells/emergency-queue-name-cell.component';
import { EmergencyQueuePriorityCell } from './cells/emergency-queue-priority-cell.component';
import { EmergencyQueueProviderCell } from './cells/emergency-queue-provider-cell.component';
import { EmergencyQueueStatusCell } from './cells/emergency-queue-status-cell.component';
import { EmergencyQueueWaitTimeCell } from './cells/emergency-queue-wait-time-cell.component';

export interface EmergencyQueueTableColumn {
  key: string;
  header: string;
  CellComponent: React.FC<{ queueEntry: EmergencyQueueEntry }>;
  getFilterableValue?: (queueEntry: EmergencyQueueEntry) => string | null;
}

export function useEmergencyQueueColumns(): EmergencyQueueTableColumn[] {
  const { t } = useTranslation();

  return [
    {
      key: 'patient',
      header: t('patient', 'Patient'),
      CellComponent: EmergencyQueueNameCell,
      getFilterableValue: (queueEntry) => queueEntry.patient.display,
    },
    {
      key: 'priority',
      header: t('priority', 'Priority'),
      CellComponent: EmergencyQueuePriorityCell,
      getFilterableValue: (queueEntry) => queueEntry.priority?.display || null,
    },
    {
      key: 'status',
      header: t('status', 'Status'),
      CellComponent: EmergencyQueueStatusCell,
      getFilterableValue: (queueEntry) => queueEntry.status?.display || null,
    },
    {
      key: 'provider',
      header: t('provider', 'Prestador'),
      CellComponent: EmergencyQueueProviderCell,
      getFilterableValue: (queueEntry) => queueEntry.providerWaitingFor?.display || null,
    },
    {
      key: 'waitTime',
      header: t('waitTime', 'Wait time'),
      CellComponent: EmergencyQueueWaitTimeCell,
    },
    {
      key: 'actions',
      header: t('actions', 'Actions'),
      CellComponent: EmergencyQueueActionsCell,
    },
  ];
}
