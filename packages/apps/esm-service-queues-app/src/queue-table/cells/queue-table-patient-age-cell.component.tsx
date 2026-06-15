import dayjs from 'dayjs';

import { type QueueTableCellComponentProps, type QueueTableColumnFunction } from '../../types';

export const QueueTablePatientAgeCell = ({ queueEntry }: QueueTableCellComponentProps) => {
  const birthdate = dayjs(queueEntry.patient.person.birthdate);
  const todaydate = dayjs();
  const age = todaydate.diff(birthdate, 'years');

  return <span>{age}</span>;
};

export const queueTablePatientAgeColumn: QueueTableColumnFunction = (key, header) => ({
  key,
  header,
  CellComponent: QueueTablePatientAgeCell,
  getFilterableValue: null,
});
