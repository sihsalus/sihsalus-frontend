import { type VisitAttributeQueueNumberColumnConfig } from '../../config-schema';
import { type QueueEntry, type QueueTableColumnFunction } from '../../types';
import { useTranslation } from 'react-i18next';

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
    const { t } = useTranslation();
    const emptyValue = queueEntry.visit ? t('notAvailable', 'Not available') : t('notApplicable', 'Not applicable');
    return <span>{getVisitQueueNumber(queueEntry) ?? emptyValue}</span>;
  };

  return {
    key,
    header,
    CellComponent: QueueTableVisitAttributeQueueNumberCell,
    getFilterableValue: getVisitQueueNumber,
  };
};
