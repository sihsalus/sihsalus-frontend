import { Tag } from '@carbon/react';
import { getQueueEntryDocumentNumber, getQueueEntryMedicalRecordNumber } from '../emergency-queue-identity.utils';
import { type EmergencyQueueTableCellProps } from './emergency-queue-name-cell.component';

export const EmergencyQueueIdentifierCell = ({ queueEntry }: EmergencyQueueTableCellProps) => {
  const medicalRecordNumber = getQueueEntryMedicalRecordNumber(queueEntry);
  const documentNumber = getQueueEntryDocumentNumber(queueEntry);

  return (
    <div>
      <Tag type="blue" size="sm">
        {medicalRecordNumber || '-'}
      </Tag>
      {documentNumber ? <div>{documentNumber}</div> : null}
    </div>
  );
};
