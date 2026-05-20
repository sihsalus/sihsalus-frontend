import { type PriorityColumnConfig } from '../../config-schema';
import QueuePriority from '../../queue-entry-table-components/queue-priority.component';
import { type QueueTableCellComponentProps, type QueueTableColumnFunction } from '../../types';

export const queueTablePriorityColumn: QueueTableColumnFunction = (key, header, config: PriorityColumnConfig) => {
  const QueueTablePriorityCell = ({ queueEntry }: QueueTableCellComponentProps) => {
    return (
      <QueuePriority
        priority={queueEntry.priority}
        priorityComment={queueEntry.priorityComment}
        priorityConfigs={config?.priorityConfigs}
      />
    );
  };

  return {
    key,
    header,
    CellComponent: QueueTablePriorityCell,
    getFilterableValue: (queueEntry) => queueEntry.priority.display,
  };
};
