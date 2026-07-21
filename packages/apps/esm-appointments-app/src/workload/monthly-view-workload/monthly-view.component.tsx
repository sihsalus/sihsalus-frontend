import { Button } from '@carbon/react';
import { Calendar, ChevronLeft, ChevronRight } from '@carbon/react/icons';
import classNames from 'classnames';
import dayjs, { type Dayjs } from 'dayjs';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import styles from './monthly-workload.scss';

interface MonthlyCalendarViewProps {
  calendarWorkload: Array<{ count: number; date: string }>;
  displayedMonth: Date;
  selectedDate: Date;
  minDate?: Date;
  onDateClick?: (pickedDate: Date) => void;
  onMonthChange: (month: Date) => void;
}

const daysPerWeek = 7;
const calendarCellCount = 42;
const mondayReferenceDate = new Date(2024, 0, 1);

function getCalendarDays(month: Date) {
  const monthStart = dayjs(month).startOf('month');
  const mondayBasedOffset = (monthStart.day() + 6) % daysPerWeek;
  const gridStart = monthStart.subtract(mondayBasedOffset, 'day');

  return Array.from({ length: calendarCellCount }, (_value, index) => gridStart.add(index, 'day'));
}

function getSupportedLocale(locale: unknown) {
  if (typeof locale !== 'string' || !locale.trim()) {
    return 'es';
  }

  try {
    return Intl.getCanonicalLocales(locale)[0] ?? 'es';
  } catch {
    return 'es';
  }
}

const MonthlyCalendarView: React.FC<MonthlyCalendarViewProps> = ({
  calendarWorkload,
  displayedMonth,
  selectedDate,
  minDate,
  onDateClick,
  onMonthChange,
}) => {
  const { i18n, t } = useTranslation();
  const locale = getSupportedLocale(i18n?.resolvedLanguage ?? i18n?.language);
  const month = dayjs(displayedMonth).startOf('month');
  const minimumDate = minDate ? dayjs(minDate).startOf('day') : null;
  const previousMonth = month.subtract(1, 'month');
  const nextMonth = month.add(1, 'month');
  const cannotNavigateToPreviousMonth = Boolean(minimumDate && previousMonth.endOf('month').isBefore(minimumDate));

  const monthLabel = useMemo(
    () => new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(displayedMonth),
    [displayedMonth, locale],
  );
  const fullDateFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric' }),
    [locale],
  );
  const weekdayFormatter = useMemo(() => new Intl.DateTimeFormat(locale, { weekday: 'short' }), [locale]);
  const weekdayLabels = useMemo(
    () =>
      Array.from({ length: daysPerWeek }, (_value, index) =>
        weekdayFormatter.format(dayjs(mondayReferenceDate).add(index, 'day').toDate()).replace('.', ''),
      ),
    [weekdayFormatter],
  );
  const workloadByDate = useMemo(
    () => new Map(calendarWorkload.map(({ date, count }) => [date, count])),
    [calendarWorkload],
  );

  const selectDate = (date: Dayjs) => {
    if (minimumDate && date.isBefore(minimumDate, 'day')) {
      return;
    }
    onDateClick?.(date.startOf('day').toDate());
  };

  return (
    <section className={styles.calendar} aria-label={t('appointmentAvailabilityCalendar', 'Appointment calendar')}>
      <header className={styles.calendarHeader}>
        <div className={styles.calendarTitleContainer}>
          <Calendar aria-hidden="true" size={20} />
          <div>
            <p className={styles.calendarEyebrow}>{t('scheduledAppointments', 'Scheduled appointments')}</p>
            <h3 className={styles.calendarTitle}>{monthLabel}</h3>
          </div>
        </div>
        <div className={styles.monthNavigation}>
          <Button
            disabled={cannotNavigateToPreviousMonth}
            hasIconOnly
            iconDescription={t('previousMonth', 'Previous month')}
            kind="ghost"
            onClick={() => onMonthChange(previousMonth.toDate())}
            renderIcon={ChevronLeft}
            size="sm"
            tooltipAlignment="end"
            type="button"
          />
          <Button
            hasIconOnly
            iconDescription={t('nextMonth', 'Next month')}
            kind="ghost"
            onClick={() => onMonthChange(nextMonth.toDate())}
            renderIcon={ChevronRight}
            size="sm"
            tooltipAlignment="end"
            type="button"
          />
        </div>
      </header>

      <div className={styles.calendarGrid} role="grid" aria-label={monthLabel}>
        {weekdayLabels.map((weekday) => (
          <div className={styles.weekday} key={weekday} role="columnheader">
            {weekday}
          </div>
        ))}

        {getCalendarDays(displayedMonth).map((date) => {
          const dateKey = date.format('YYYY-MM-DD');
          const appointmentCount = workloadByDate.get(dateKey) ?? 0;
          const isInDisplayedMonth = date.isSame(month, 'month');
          const isSelected = date.isSame(selectedDate, 'day');
          const isToday = date.isSame(dayjs(), 'day');
          const isBeforeMinimum = Boolean(minimumDate && date.isBefore(minimumDate, 'day'));
          const isDisabled = !isInDisplayedMonth || isBeforeMinimum;
          const formattedDate = fullDateFormatter.format(date.toDate());
          const appointmentCountLabel = t(
            'appointmentCountForDate',
            '{{count}} scheduled appointment',
            { count: appointmentCount },
          );

          return (
            <div className={styles.dayCell} key={dateKey} role="gridcell" aria-selected={isSelected}>
              <button
                aria-current={isToday ? 'date' : undefined}
                aria-label={`${formattedDate}. ${appointmentCountLabel}`}
                className={classNames(styles.dayButton, {
                  [styles.dayButtonAdjacent]: !isInDisplayedMonth,
                  [styles.dayButtonDisabled]: isBeforeMinimum,
                  [styles.dayButtonSelected]: isSelected,
                  [styles.dayButtonToday]: isToday && !isSelected,
                })}
                disabled={isDisabled}
                onClick={() => selectDate(date)}
                type="button"
              >
                <span className={styles.dayNumber}>{date.date()}</span>
                {isInDisplayedMonth ? (
                  <span
                    className={classNames(styles.appointmentCount, {
                      [styles.appointmentCountEmpty]: appointmentCount === 0,
                    })}
                  >
                    {appointmentCount}
                  </span>
                ) : null}
              </button>
            </div>
          );
        })}
      </div>

      <footer className={styles.calendarFooter}>
        <span aria-hidden="true" className={styles.countExample}>0</span>
        <span>{t('calendarAppointmentCountLegend', 'Number of scheduled appointments')}</span>
      </footer>
    </section>
  );
};

export default MonthlyCalendarView;
