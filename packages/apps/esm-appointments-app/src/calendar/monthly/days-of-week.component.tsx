import classNames from 'classnames';
import dayjs from 'dayjs';
import React from 'react';

import styles from './days-of-week.scss';

interface DaysOfWeekProps {
  dayIndex: number;
  dayOfWeek: string;
}

const DaysOfWeekCard: React.FC<DaysOfWeekProps> = ({ dayIndex, dayOfWeek }) => {
  const isToday = dayjs().day() === dayIndex;
  return (
    <div tabIndex={0} role="button" className={styles.tileContainer}>
      <span className={classNames({ [styles.bold]: isToday })}>{dayOfWeek}</span>
    </div>
  );
};
export default DaysOfWeekCard;
