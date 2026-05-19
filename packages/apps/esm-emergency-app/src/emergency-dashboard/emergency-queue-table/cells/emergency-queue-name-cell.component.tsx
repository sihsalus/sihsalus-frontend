/**
 * Queue table cell displaying patient name as a clickable link to their chart,
 * with the most relevant identity document (DNI preferred, HCE fallback).
 */

import { ConfigurableLink } from '@openmrs/esm-framework';
import { getPreferredIdentifier } from '@sihsalus/esm-sihsalus-shared';
import { type EmergencyQueueEntry } from '../../../resources/emergency.resource';

/** Shared props interface for all emergency queue table cell components. */
export interface EmergencyQueueTableCellProps {
  queueEntry: EmergencyQueueEntry;
}

export const EmergencyQueueNameCell = ({ queueEntry }: EmergencyQueueTableCellProps) => {
  const identifiers = queueEntry.patient.identifiers || [];
  const preferredIdentifier = getPreferredIdentifier(identifiers);
  const patientName = queueEntry.patient.person?.display || queueEntry.patient.display;

  return (
    <ConfigurableLink to={`${globalThis.spaBase}/patient/${queueEntry.patient.uuid}/chart`}>
      {patientName}
      {preferredIdentifier
        ? ` - ${preferredIdentifier.identifierType?.display}: ${preferredIdentifier.identifier}`
        : ''}
    </ConfigurableLink>
  );
};
