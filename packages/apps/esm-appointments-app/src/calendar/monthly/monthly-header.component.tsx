import { Button } from '@carbon/react';
import { formatDate } from '@openmrs/esm-framework';
import dayjs from 'dayjs';
import React, { useCallback, useContext } from 'react';
import { useTranslation } from 'react-i18next';

import { omrsDateFormat } from '../../constants';
import SelectedDateContext from '../../hooks/selectedDateContext';

import DaysOfWeekCard from './days-of-week.component';
import styles from './monthly-header.scss';

const SUNDAY_UTC = new Date(Date.UTC(2026, 0, 4));

export function getLocalizedDaysOfWeek(language = 'en'): Array<string> {
  let locale = language.replace('_', '-');
  let formatter: Intl.DateTimeFormat;

  try {
    formatter = new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' });
  } catch {
    locale = 'en';
    formatter = new Intl.DateTimeFormat('en', { weekday: 'short', timeZone: 'UTC' });
  }

  return Array.from({ length: 7 }, (_value, dayIndex) => {
    const date = new Date(SUNDAY_UTC);
    date.setUTCDate(SUNDAY_UTC.getUTCDate() + dayIndex);
    const label = formatter.format(date).replace(/\.$/u, '');

    return `${label.charAt(0).toLocaleUpperCase(locale)}${label.slice(1)}`;
  });
}

const MonthlyHeader: React.FC = () => {
  const { i18n, t } = useTranslation();
  const { selectedDate, setSelectedDate } = useContext(SelectedDateContext);
  const daysOfWeek = getLocalizedDaysOfWeek(i18n.language);

  const handleSelectPrevMonth = useCallback(() => {
    setSelectedDate(dayjs(selectedDate).subtract(1, 'month').format(omrsDateFormat));
  }, [selectedDate, setSelectedDate]);

  const handleSelectNextMonth = useCallback(() => {
    setSelectedDate(dayjs(selectedDate).add(1, 'month').format(omrsDateFormat));
  }, [selectedDate, setSelectedDate]);

  return (
    <>
      <div className={styles.container}>
        <Button
          aria-label={t('previousMonth', 'Previous month')}
          kind="tertiary"
          onClick={handleSelectPrevMonth}
          size="sm"
        >
          {t('prev', 'Prev')}
        </Button>
        <span>{formatDate(new Date(selectedDate), { day: false, time: false, noToday: true })}</span>
        <Button aria-label={t('nextMonth', 'Next month')} kind="tertiary" onClick={handleSelectNextMonth} size="sm">
          {t('next', 'Next')}
        </Button>
      </div>
      <div className={styles.workLoadCard}>
        {daysOfWeek.map((day, dayIndex) => (
          <DaysOfWeekCard key={day} dayIndex={dayIndex} dayOfWeek={day} />
        ))}
      </div>
    </>
  );
};

export default MonthlyHeader;
