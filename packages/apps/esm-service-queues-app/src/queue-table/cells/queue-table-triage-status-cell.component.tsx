import { Tag } from '@carbon/react';
import { useTranslation } from 'react-i18next';

import { type QueueTableCellComponentProps, type QueueTableColumnFunction } from '../../types';

export function QueueTableTriageStatusCell({ queueEntry }: QueueTableCellComponentProps) {
  const { t } = useTranslation();
  const state = queueEntry.workflow?.triageState ?? 'notRequired';
  const content = {
    loading: { label: t('triageChecking', 'Verificando'), type: 'gray' as const },
    pending: { label: t('triagePending', 'Pendiente'), type: 'blue' as const },
    completed: { label: t('triageCompleted', 'Realizado'), type: 'green' as const },
    notRequired: { label: t('triageNotRequired', 'No aplica'), type: 'gray' as const },
  }[state];

  return <Tag type={content.type}>{content.label}</Tag>;
}

export const queueTableTriageStatusColumn: QueueTableColumnFunction = (key, header) => ({
  key,
  header,
  CellComponent: QueueTableTriageStatusCell,
  getFilterableValue: (queueEntry) => queueEntry.workflow?.triageState ?? 'notRequired',
});
