import React, { useState } from 'react';

import MonthlyCalendarView from './monthly-view-workload/monthly-view.component';
import { useCalendarDistribution, useMonthlyCalendarDistribution } from './workload.resource';
import styles from './workload.scss';

interface WorkloadProps {
  selectedServiceUuid: string;
  appointmentDate: Date;
  onWorkloadDateChange: (pickedDate: Date) => void;
}

const Workload: React.FC<WorkloadProps> = ({ selectedServiceUuid, appointmentDate, onWorkloadDateChange }) => {
  const [selectedTab] = useState(0);

  // Prefetch via SWR cache — result no se consume aún (semana vs mes pendiente de integrar).
  const _calendarWorkload = useCalendarDistribution(
    selectedServiceUuid,
    selectedTab === 0 ? 'week' : 'month',
    appointmentDate,
  );

  const monthlyCalendarWorkload = useMonthlyCalendarDistribution(
    selectedServiceUuid,
    selectedTab === 0 ? 'week' : 'month',
    appointmentDate,
  );

  const handleDateClick = (pickedDate: Date) => onWorkloadDateChange(pickedDate);

  return (
    <div className={styles.workLoadContainer}>
      <MonthlyCalendarView
        calendarWorkload={monthlyCalendarWorkload}
        dateToDisplay={appointmentDate.toISOString()}
        onDateClick={handleDateClick}
      />
    </div>
  );
};

export default Workload;
