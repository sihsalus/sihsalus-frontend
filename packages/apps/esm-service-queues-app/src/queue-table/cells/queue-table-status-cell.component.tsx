import { type StatusColumnConfig } from '../../config-schema';
import QueueStatus from '../../queue-entry-table-components/queue-status.component';
import { type QueueTableCellComponentProps, type QueueTableColumnFunction } from '../../types';

export const queueTableStatusColumn: QueueTableColumnFunction = (key, header, config: StatusColumnConfig) => {
  const QueueTableStatusCell = ({ queueEntry }: QueueTableCellComponentProps) => {
    // Do not pass queue into status, as we do not want to render it
    return <QueueStatus status={queueEntry.status} statusConfigs={config?.statusConfigs} />;
  };

  return {
    key,
    header,
    CellComponent: QueueTableStatusCell,
    getFilterableValue: (queueEntry) => queueEntry.status.display,
  };
};
