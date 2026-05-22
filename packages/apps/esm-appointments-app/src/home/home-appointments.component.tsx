import { toOmrsIsoString } from '@openmrs/esm-framework';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';

import AppointmentsList from '../appointments/scheduled/appointments-list.component';

import styles from './home-appointments.scss';

const HomeAppointments = () => {
  const { t } = useTranslation();

  return (
    <div className={styles.container}>
      <AppointmentsList
        date={toOmrsIsoString(dayjs().startOf('day').toDate())}
        excludeCancelledAppointments
        title={t('todaysAppointments', "Today's Appointments")}
      />
    </div>
  );
};

export default HomeAppointments;
