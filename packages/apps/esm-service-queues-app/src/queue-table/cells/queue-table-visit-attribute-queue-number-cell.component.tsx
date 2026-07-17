import { type VisitAttributeQueueNumberColumnConfig } from '../../config-schema';
import { type QueueEntry, type QueueTableColumnFunction } from '../../types';

export const queueTableVisitAttributeQueueNumberColumn: QueueTableColumnFunction = (
  key,
  header,
  { visitQueueNumberAttributeUuid }: VisitAttributeQueueNumberColumnConfig,
) => {
  if (!visitQueueNumberAttributeUuid) {
    return null;
  }

  function getVisitQueueNumber(queueEntry: QueueEntry) {
    const value = queueEntry.visit?.attributes?.find(
      (e) => e?.attributeType?.uuid === visitQueueNumberAttributeUuid,
    )?.value;
    return value == null || String(value).trim() === '' ? null : String(value);
  }

  const QueueTableVisitAttributeQueueNumberCell = ({ queueEntry }: { queueEntry: QueueEntry }) => {
    return <span>{getVisitQueueNumber(queueEntry) ?? '--'}</span>;
  };

  return {
    key,
    header,
    CellComponent: QueueTableVisitAttributeQueueNumberCell,
    getFilterableValue: getVisitQueueNumber,
  };
};
