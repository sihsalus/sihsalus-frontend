import dayjs from 'dayjs';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';

import { omrsDateFormat } from '../constants';
import AppointmentsHeader from '../header/appointments-header.component';
import SelectedDateContext from '../hooks/selectedDateContext';
import { useAppointmentServiceFilter } from '../hooks/useAppointmentServiceFilter';
import { useAppointmentsCalendar } from '../hooks/useAppointmentsCalendar';
import { type DailyAppointmentsCountByService } from '../types';

import CalendarHeader from './header/calendar-header.component';
import MonthlyCalendarView from './monthly/monthly-calendar-view.component';

export function filterCalendarEventsByServiceTypes(
  calendarEvents: Array<DailyAppointmentsCountByService> | undefined,
  appointmentServiceTypes: Array<string>,
) {
  const events = calendarEvents ?? [];

  if (!appointmentServiceTypes.length) {
    return events;
  }

  return events
    .map((event) => ({
      ...event,
      services: event.services.filter((service) => appointmentServiceTypes.includes(service.serviceUuid)),
    }))
    .filter((event) => event.services.length);
}

const AppointmentsCalendarView: React.FC = () => {
  const { t } = useTranslation();
  const [selectedDate, setSelectedDate] = useState(dayjs().startOf('day').format(omrsDateFormat));
  const { appointmentServiceTypes, setAppointmentServiceTypes } = useAppointmentServiceFilter();
  const { calendarEvents } = useAppointmentsCalendar(dayjs(selectedDate).toISOString(), 'monthly');
  const filteredCalendarEvents = useMemo(
    () => filterCalendarEventsByServiceTypes(calendarEvents, appointmentServiceTypes),
    [appointmentServiceTypes, calendarEvents],
  );

  const params = useParams();

  useEffect(() => {
    if (params.date) {
      setSelectedDate(dayjs(params.date).startOf('day').format(omrsDateFormat));
    }
  }, [params.date]);

  return (
    <SelectedDateContext.Provider value={{ selectedDate, setSelectedDate }}>
      <div data-testid="appointments-calendar">
        <AppointmentsHeader
          appointmentServiceTypes={appointmentServiceTypes}
          onChange={setAppointmentServiceTypes}
          title={t('calendar', 'Calendar')}
        />
        <CalendarHeader appointmentServiceTypes={appointmentServiceTypes} />
        <MonthlyCalendarView events={filteredCalendarEvents} appointmentServiceTypes={appointmentServiceTypes} />
      </div>
    </SelectedDateContext.Provider>
  );
};

export default AppointmentsCalendarView;
