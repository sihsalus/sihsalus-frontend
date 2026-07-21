import dayjs from 'dayjs';
import React, { useEffect, useState } from 'react';

import { useAppointmentService } from '../form/appointments-form.resource';

import MonthlyCalendarView from './monthly-view-workload/monthly-view.component';
import { useMonthlyCalendarDistribution } from './workload.resource';
import styles from './workload.scss';

interface WorkloadProps {
  selectedService: string;
  appointmentDate: Date;
  minDate?: Date;
  onWorkloadDateChange: (pickedDate: Date) => void;
}

const Workload: React.FC<WorkloadProps> = ({ selectedService, appointmentDate, minDate, onWorkloadDateChange }) => {
  const { data: services } = useAppointmentService();
  const serviceUuid = services?.find((service) => service.name === selectedService)?.uuid;
  const [displayedMonth, setDisplayedMonth] = useState(() => dayjs(appointmentDate).startOf('month').toDate());

  useEffect(() => {
    setDisplayedMonth(dayjs(appointmentDate).startOf('month').toDate());
  }, [appointmentDate]);

  const monthlyCalendarWorkload = useMonthlyCalendarDistribution(
    serviceUuid,
    'month',
    displayedMonth,
  );

  const handleDateClick = (pickedDate: Date) => onWorkloadDateChange(pickedDate);

  return (
    <div className={styles.workLoadContainer}>
      <MonthlyCalendarView
        calendarWorkload={monthlyCalendarWorkload}
        displayedMonth={displayedMonth}
        minDate={minDate}
        onMonthChange={setDisplayedMonth}
        onDateClick={handleDateClick}
        selectedDate={appointmentDate}
      />
    </div>
  );
};

export default Workload;
