import { getPreferredIdentifier } from '@openmrs/esm-framework';

import { type PatientIdentifierColumnConfig } from '../../config-schema';
import { type QueueEntry, type QueueTableCellComponentProps, type QueueTableColumnFunction } from '../../types';

export const queueTablePatientIdentifierColumn: QueueTableColumnFunction = (
  key,
  header,
  config: PatientIdentifierColumnConfig,
) => {
  const { identifierTypeUuid } = config;

  const getPatientIdentifier = (queueEntry: QueueEntry) => {
    const configuredIdentifier = queueEntry.patient.identifiers.find(
      (i) => i.identifierType?.uuid === identifierTypeUuid,
    );
    return getPreferredIdentifier(queueEntry.patient.identifiers)?.identifier ?? configuredIdentifier?.identifier;
  };

  const QueueTablePatientIdentifierCell = ({ queueEntry }: QueueTableCellComponentProps) => {
    return <span>{getPatientIdentifier(queueEntry)}</span>;
  };

  return {
    key,
    header,
    CellComponent: QueueTablePatientIdentifierCell,
    getFilterableValue: getPatientIdentifier,
  };
};
