import dayjs from 'dayjs';
import { useContext } from 'react';
import { useTranslation } from 'react-i18next';

import SelectedDateContext from '../../hooks/selectedDateContext';
import { useAppointmentList } from '../../hooks/useAppointmentList';
import { useScheduledAppointments } from '../../hooks/useClinicalMetrics';
import MetricsCard from '../metrics-card.component';

/**
 * This extension shows the metrics of the number of scheduled appointments for the selected date and services,
 * showing the total number of appointments (across all status), the number of checked in ones (status == CheckedIn),
 * and number of not arrived (status == Scheduled).
 */
export default function ScheduledAppointmentsExtension() {
  const { t } = useTranslation();
  const { selectedDate } = useContext(SelectedDateContext);

  const { totalScheduledAppointments } = useScheduledAppointments([]);

  const { appointmentList: arrivedAppointments } = useAppointmentList('CheckedIn');
  const { appointmentList: pendingAppointments } = useAppointmentList('Scheduled');

  const count = {
    arrivedAppointments,
    pendingAppointments,
  };
  const scheduledAppointmentsLabel = dayjs(selectedDate).isSame(dayjs(), 'day')
    ? t('scheduledForToday', 'Appointments scheduled today')
    : t('scheduledAppointments', 'Scheduled appointments');

  return (
    <MetricsCard
      count={count}
      headerLabel={scheduledAppointmentsLabel}
      label={t('appointments', 'Appointments')}
      value={totalScheduledAppointments}
    />
  );
}
