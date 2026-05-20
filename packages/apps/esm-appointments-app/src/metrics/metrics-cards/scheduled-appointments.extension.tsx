import { useTranslation } from 'react-i18next';
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

  const { totalScheduledAppointments } = useScheduledAppointments([]);

  const { appointmentList: arrivedAppointments } = useAppointmentList('CheckedIn');
  const { appointmentList: pendingAppointments } = useAppointmentList('Scheduled');

  const count = {
    arrivedAppointments,
    pendingAppointments,
  };

  return (
    <MetricsCard
      count={count}
      headerLabel={t('scheduledAppointments', 'Scheduled appointments')}
      label={t('appointments', 'Appointments')}
      value={totalScheduledAppointments}
    />
  );
}
