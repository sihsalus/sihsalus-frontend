import { formatDatetime } from '@openmrs/esm-framework';

import { type QueueEntry, type QueueTableCellComponentProps, type QueueTableColumnFunction } from '../../types';

export const queueTableVisitStartTimeColumn: QueueTableColumnFunction = (key, header) => {
  function getVisitStartTime(queueEntry: QueueEntry) {
    return formatDatetime(new Date(queueEntry.visit?.startDatetime));
  }

  const QueueTableVisitStartTimeCell = ({ queueEntry }: QueueTableCellComponentProps) => {
    return <span>{getVisitStartTime(queueEntry)}</span>;
  };

  return {
    key,
    header,
    CellComponent: QueueTableVisitStartTimeCell,
    getFilterableValue: getVisitStartTime,
  };
};
