import { ErrorState, formatDate, parseDate } from '@openmrs/esm-framework';
import dayjs from 'dayjs';
import React, { useContext } from 'react';
import { useTranslation } from 'react-i18next';

import { filterByServiceType } from '../appointments/utils';
import SelectedDateContext from '../hooks/selectedDateContext';
import { useAppointmentList } from '../hooks/useAppointmentList';
import { useAllAppointmentsByDate, useClinicalMetrics, useScheduledAppointments } from '../hooks/useClinicalMetrics';
import { AppointmentStatus } from '../types';

import styles from './appointments-metrics.scss';
import MetricsCard from './metrics-card.component';
import MetricsHeader from './metrics-header.component';

interface AppointmentMetricsProps {
  appointmentServiceTypes: Array<string>;
}

const AppointmentsMetrics: React.FC<AppointmentMetricsProps> = ({ appointmentServiceTypes }) => {
  const { t } = useTranslation();

  const { highestServiceLoad, error: summaryError } = useClinicalMetrics(appointmentServiceTypes);
  const { totalProviders, error: providersError } = useAllAppointmentsByDate(appointmentServiceTypes);
  const { totalScheduledAppointments, error: appointmentsError } =
    useScheduledAppointments(appointmentServiceTypes);

  const { selectedDate } = useContext(SelectedDateContext);
  const formattedStartDate = formatDate(parseDate(selectedDate), { mode: 'standard', time: false });
  const scheduledAppointmentsLabel = dayjs(selectedDate).isSame(dayjs(), 'day')
    ? t('scheduledForToday', 'Appointments scheduled today')
    : t('scheduledAppointments', 'Scheduled appointments');

  const { appointmentList: arrivedAppointments, error: arrivedAppointmentsError } = useAppointmentList(
    AppointmentStatus.CHECKEDIN,
  );
  const { appointmentList: pendingAppointments, error: pendingAppointmentsError } = useAppointmentList(
    AppointmentStatus.SCHEDULED,
  );

  const filteredArrivedAppointments = filterByServiceType(arrivedAppointments, appointmentServiceTypes);
  const filteredPendingAppointments = filterByServiceType(pendingAppointments, appointmentServiceTypes);
  const error =
    summaryError ??
    providersError ??
    appointmentsError ??
    arrivedAppointmentsError ??
    pendingAppointmentsError;

  if (error) {
    return (
      <div className={styles.errorContainer}>
        <ErrorState headerTitle={t('appointmentMetricsLoadError', 'Metrics load error')} error={error} />
      </div>
    );
  }

  return (
    <>
      <MetricsHeader />
      <section className={styles.cardContainer}>
        <MetricsCard
          count={{ pendingAppointments: filteredPendingAppointments, arrivedAppointments: filteredArrivedAppointments }}
          headerLabel={scheduledAppointmentsLabel}
          label={t('appointments', 'Appointments')}
          value={totalScheduledAppointments}
        />
        <MetricsCard
          headerLabel={t('highestServiceVolume', 'Highest volume service: {{time}}', { time: formattedStartDate })}
          label={
            highestServiceLoad?.count !== 0 ? t(highestServiceLoad?.serviceName) : t('serviceName', 'Service name')
          }
          value={highestServiceLoad?.count ?? '--'}
        />
        <MetricsCard
          headerLabel={t('providersBooked', 'Providers booked: {{time}}', { time: formattedStartDate })}
          label={t('providers', 'Providers')}
          value={totalProviders}
        />
      </section>
    </>
  );
};

export default AppointmentsMetrics;
