import { useTranslation } from 'react-i18next';
import type { Config } from '../../config-schema';
import { type EmergencyQueueEntry } from '../../resources/emergency.resource';
import { EmergencyQueueActionsCell } from './cells/emergency-queue-actions-cell.component';
import { EmergencyQueueIdentificationStatusCell } from './cells/emergency-queue-identification-status-cell.component';
import { EmergencyQueueIdentifierCell } from './cells/emergency-queue-identifier-cell.component';
import { EmergencyQueueNameCell } from './cells/emergency-queue-name-cell.component';
import { EmergencyQueuePriorityCell } from './cells/emergency-queue-priority-cell.component';
import { EmergencyQueueProviderCell } from './cells/emergency-queue-provider-cell.component';
import { EmergencyQueueResponsibleCell } from './cells/emergency-queue-responsible-cell.component';
import { EmergencyQueueStatusCell } from './cells/emergency-queue-status-cell.component';
import { EmergencyQueueWaitTimeCell } from './cells/emergency-queue-wait-time-cell.component';
import {
  getQueueEntryCommunicationCondition,
  getQueueEntryDocumentNumber,
  getQueueEntryIdentificationStatus,
  getQueueEntryMedicalRecordNumber,
  getQueueEntryResponsibleName,
} from './emergency-queue-identity.utils';

export interface EmergencyQueueTableColumn {
  key: string;
  header: string;
  CellComponent: React.FC<{ queueEntry: EmergencyQueueEntry }>;
  getFilterableValue?: (queueEntry: EmergencyQueueEntry) => string | null;
}

export function useEmergencyQueueColumns(
  patientRegistration?: Config['patientRegistration'],
): EmergencyQueueTableColumn[] {
  const { t } = useTranslation();

  return [
    {
      key: 'patient',
      header: t('patient', 'Patient'),
      CellComponent: EmergencyQueueNameCell,
      getFilterableValue: (queueEntry) => queueEntry.patient.display,
    },
    {
      key: 'identifier',
      header: t('medicalRecordNumber', 'HCE / código'),
      CellComponent: EmergencyQueueIdentifierCell,
      getFilterableValue: (queueEntry) =>
        [getQueueEntryMedicalRecordNumber(queueEntry), getQueueEntryDocumentNumber(queueEntry)].join(' '),
    },
    {
      key: 'identificationStatus',
      header: t('identificationStatus', 'Identificación'),
      CellComponent: EmergencyQueueIdentificationStatusCell,
      getFilterableValue: (queueEntry) => getQueueEntryIdentificationStatus(queueEntry, patientRegistration),
    },
    {
      key: 'responsible',
      header: t('responsiblePerson', 'Responsable'),
      CellComponent: EmergencyQueueResponsibleCell,
      getFilterableValue: (queueEntry) =>
        [getQueueEntryResponsibleName(queueEntry), getQueueEntryCommunicationCondition(queueEntry)].join(' '),
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
