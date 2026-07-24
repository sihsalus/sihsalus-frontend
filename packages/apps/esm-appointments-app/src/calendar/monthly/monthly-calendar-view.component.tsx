import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';
import React, { useContext } from 'react';

import { monthDays } from '../../helpers';
import SelectedDateContext from '../../hooks/selectedDateContext';
import { type DailyAppointmentsCountByService } from '../../types';
import styles from '../appointments-calendar-view-view.scss';

import MonthlyHeader from './monthly-header.component';
import MonthlyViewWorkload from './monthly-workload-view.component';

dayjs.extend(isBetween);

interface MonthlyCalendarViewProps {
  events: Array<DailyAppointmentsCountByService>;
  appointmentServiceTypes: Array<string>;
}

const MonthlyCalendarView: React.FC<MonthlyCalendarViewProps> = ({ appointmentServiceTypes, events }) => {
  const { selectedDate } = useContext(SelectedDateContext);

  return (
    <div className={styles.calendarViewContainer}>
      <MonthlyHeader />
      <div className={styles.wrapper}>
        <div className={styles.monthlyCalendar}>
          {monthDays(dayjs(selectedDate)).map((dateTime) => (
            <MonthlyViewWorkload
              key={dateTime.format('YYYY-MM-DD')}
              appointmentServiceTypes={appointmentServiceTypes}
              dateTime={dateTime}
              events={events}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default MonthlyCalendarView;
