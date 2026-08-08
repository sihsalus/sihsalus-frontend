import { formatTime, parseDate } from '@openmrs/esm-framework';

import { type QueueTableCellComponentProps, type QueueTableColumnFunction } from '../../types';

export function QueueTableAppointmentTimeCell({ queueEntry }: QueueTableCellComponentProps) {
  const startDateTime = queueEntry.workflow?.appointmentStartDateTime;
  return <span>{startDateTime ? formatTime(parseDate(startDateTime)) : '—'}</span>;
}

export const queueTableAppointmentTimeColumn: QueueTableColumnFunction = (key, header) => ({
  key,
  header,
  CellComponent: QueueTableAppointmentTimeCell,
  getFilterableValue: (queueEntry) => queueEntry.workflow?.appointmentStartDateTime ?? null,
});
