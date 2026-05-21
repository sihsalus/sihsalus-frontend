import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';
import React, { useState } from 'react';

import SelectedDateContext from '../../hooks/selectedDateContext';
import type { AppointmentFilterCalendarProps } from '../../types';
import { omrsDateFormat } from '../../utils/constants';
import { monthDays } from '../../utils/utils';

import { useAppointmentsByPatient } from './appointment-filter-calendar.resource';
import styles from './appointments-calendar-view-view.scss';
import MonthlyHeader from './monthly/monthly-header.component';
import MonthlyViewWorkload from './monthly/monthly-workload-view.component';

dayjs.extend(isBetween);

const MonthlyCalendarView: React.FC<AppointmentFilterCalendarProps> = ({
  patientId,
  appointmentTypeFilter: _appointmentTypeFilter,
}) => {
  const [selectedDate, setSelectedDate] = useState(dayjs().startOf('day').format(omrsDateFormat));
  const { appointments } = useAppointmentsByPatient(patientId, { startDate: dayjs().startOf('day').toISOString() });
  //const { _selectedDate } = useContext(SelectedDateContext);

  return (
    <SelectedDateContext.Provider value={{ selectedDate, setSelectedDate }}>
      {' '}
      {/* Move the provider to the parent component of the calendar */}
      <div className={styles.calendarViewContainer} style={{ width: '750px' }}>
        <MonthlyHeader />
        <div className={styles.wrapper}>
          <div className={styles.monthlyCalendar}>
            {monthDays(dayjs(selectedDate)).map((dateTime, i) => (
              <MonthlyViewWorkload key={i} dateTime={dateTime} events={appointments} />
            ))}
          </div>
        </div>
      </div>
    </SelectedDateContext.Provider>
  );
};

export default MonthlyCalendarView;
