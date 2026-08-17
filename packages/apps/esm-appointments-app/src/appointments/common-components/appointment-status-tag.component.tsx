import { Tag } from '@carbon/react';
import { useTranslation } from 'react-i18next';

import { getAppointmentStatusLabel } from '../../helpers';
import { AppointmentStatus } from '../../types';
import styles from './appointment-status-tag.scss';

type CarbonTagType = 'blue' | 'cool-gray' | 'cyan' | 'gray' | 'green' | 'purple' | 'red' | 'teal';

const appointmentStatusTagTypes: Partial<Record<AppointmentStatus, CarbonTagType>> = {
  [AppointmentStatus.REQUESTED]: 'purple',
  [AppointmentStatus.WAITLIST]: 'gray',
  [AppointmentStatus.SCHEDULED]: 'blue',
  [AppointmentStatus.ARRIVED]: 'teal',
  [AppointmentStatus.CHECKEDIN]: 'cyan',
  [AppointmentStatus.COMPLETED]: 'green',
  [AppointmentStatus.MISSED]: 'red',
};

export function AppointmentStatusTag({ status }: { status: AppointmentStatus | string | null | undefined }) {
  const { t } = useTranslation();
  const label = getAppointmentStatusLabel(status, t);

  if (!label) {
    return null;
  }

  if (status === AppointmentStatus.CANCELLED) {
    return <span className={styles.cancelledStatus}>{label}</span>;
  }

  return <Tag type={appointmentStatusTagTypes[status as AppointmentStatus] ?? 'gray'}>{label}</Tag>;
}
