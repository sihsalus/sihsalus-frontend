import { Tag } from '@carbon/react';
import { useTranslation } from 'react-i18next';

import { type QueueTableCellComponentProps, type QueueTableColumnFunction } from '../../types';

export function QueueTableSisStatusCell({ queueEntry }: QueueTableCellComponentProps) {
  const { t } = useTranslation();
  const state = queueEntry.workflow?.sisState ?? 'notApplicable';
  const content = {
    active: { label: t('sisActive', 'SIS vigente'), type: 'green' as const },
    inactive: { label: t('sisInactive', 'SIS no vigente'), type: 'red' as const },
    pending: { label: t('sisPending', 'SIS pendiente'), type: 'blue' as const },
    notConsulted: { label: t('sisNotConsulted', 'SIS no consultado'), type: 'gray' as const },
    missing: { label: t('sisMissing', 'SIS sin registrar'), type: 'magenta' as const },
    notApplicable: { label: t('sisNotApplicable', 'No SIS'), type: 'gray' as const },
  }[state];

  return <Tag type={content.type}>{content.label}</Tag>;
}

export const queueTableSisStatusColumn: QueueTableColumnFunction = (key, header) => ({
  key,
  header,
  CellComponent: QueueTableSisStatusCell,
  getFilterableValue: (queueEntry) => queueEntry.workflow?.sisState ?? 'notApplicable',
});
