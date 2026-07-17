import { formatDatetime } from '@openmrs/esm-framework';
import { useTranslation } from 'react-i18next';

import { type QueueEntry, type QueueTableCellComponentProps, type QueueTableColumnFunction } from '../../types';

export const queueTableVisitStartTimeColumn: QueueTableColumnFunction = (key, header) => {
  function getVisitStartTime(queueEntry: QueueEntry) {
    if (!queueEntry.visit?.startDatetime) {
      return null;
    }

    const startDatetime = new Date(queueEntry.visit.startDatetime);
    return Number.isNaN(startDatetime.valueOf()) ? null : formatDatetime(startDatetime);
  }

  const QueueTableVisitStartTimeCell = ({ queueEntry }: QueueTableCellComponentProps) => {
    const { t } = useTranslation();
    const emptyValue = queueEntry.visit ? t('notAvailable', 'Not available') : t('notApplicable', 'Not applicable');
    return <span>{getVisitStartTime(queueEntry) ?? emptyValue}</span>;
  };

  return {
    key,
    header,
    CellComponent: QueueTableVisitStartTimeCell,
    getFilterableValue: getVisitStartTime,
  };
};
