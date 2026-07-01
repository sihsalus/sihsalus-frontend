import { Tag } from '@carbon/react';
import { useConfig } from '@openmrs/esm-framework';
import type { Config } from '../../../config-schema';
import { getQueueEntryIdentificationStatus } from '../emergency-queue-identity.utils';
import { type EmergencyQueueTableCellProps } from './emergency-queue-name-cell.component';

export const EmergencyQueueIdentificationStatusCell = ({ queueEntry }: EmergencyQueueTableCellProps) => {
  const { patientRegistration } = useConfig<Config>();
  const identificationStatus = getQueueEntryIdentificationStatus(queueEntry, patientRegistration);
  const tagType = /pendiente|parcial/i.test(identificationStatus) ? 'red' : 'green';

  return (
    <Tag type={tagType} size="sm">
      {identificationStatus}
    </Tag>
  );
};
