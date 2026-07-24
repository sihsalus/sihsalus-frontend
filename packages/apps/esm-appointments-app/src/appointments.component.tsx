import dayjs from 'dayjs';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';

import AppointmentTabs from './appointments/appointment-tabs.component';
import { omrsDateFormat } from './constants';
import AppointmentsHeader from './header/appointments-header.component';
import SelectedDateContext from './hooks/selectedDateContext';
import { useAppointmentServiceFilter } from './hooks/useAppointmentServiceFilter';
import AppointmentMetrics from './metrics/appointments-metrics.component';

const Appointments: React.FC = () => {
  const { t } = useTranslation();
  const [selectedDate, setSelectedDate] = useState(dayjs().startOf('day').format(omrsDateFormat));

  const params = useParams();
  const { appointmentServiceTypes, setAppointmentServiceTypes } = useAppointmentServiceFilter(params.serviceType);

  useEffect(() => {
    if (params.date) {
      setSelectedDate(dayjs(params.date).startOf('day').format(omrsDateFormat));
    }
  }, [params.date]);

  return (
    <SelectedDateContext.Provider value={{ selectedDate, setSelectedDate }}>
      <AppointmentsHeader
        appointmentServiceTypes={appointmentServiceTypes}
        onChange={setAppointmentServiceTypes}
        title={t('appointments', 'Appointments')}
      />
      <AppointmentMetrics appointmentServiceTypes={appointmentServiceTypes} />
      <AppointmentTabs appointmentServiceTypes={appointmentServiceTypes} />
    </SelectedDateContext.Provider>
  );
};

export default Appointments;
