import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';
import React, { useContext } from 'react';

import { SelectedDateContext } from '@openmrs/esm-patient-common-lib';

import type { PatientAppointment } from '../../../types';
import { monthDays } from '../../../utils/utils';
import styles from '../appointments-calendar-view-view.scss';

import MonthlyHeader from './monthly-header.component';
import MonthlyViewWorkload from './monthly-workload-view.component';

dayjs.extend(isBetween);

interface MonthlyCalendarViewProps {
  events: Array<PatientAppointment>;
}

const MonthlyCalendarView: React.FC<MonthlyCalendarViewProps> = ({ events }) => {
  const { selectedDate } = useContext(SelectedDateContext);

  return (
    <div className={styles.calendarViewContainer}>
      <MonthlyHeader />
      <div className={styles.wrapper}>
        <div className={styles.monthlyCalendar}>
          {monthDays(dayjs(selectedDate)).map((dateTime) => (
            <MonthlyViewWorkload key={dateTime.format('YYYY-MM-DD')} dateTime={dateTime} events={events} />
          ))}
        </div>
      </div>
    </div>
  );
};

export default MonthlyCalendarView;
