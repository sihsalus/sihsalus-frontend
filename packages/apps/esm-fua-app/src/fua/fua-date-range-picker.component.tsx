import { DatePicker, DatePickerInput } from '@carbon/react';
import { useAppContext } from '@openmrs/esm-framework';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';

import { type DateFilterContext } from '../types';

import styles from './fua-date-range-picker.scss';

export const FuaDateRangePicker = () => {
  const { t } = useTranslation();
  const currentDate = new Date();

  const { dateRange, setDateRange } = useAppContext<DateFilterContext>('fua-date-filter') ?? {
    dateRange: [dayjs().startOf('day').toDate(), new Date()],
    setDateRange: () => {},
  };

  const handleDateRangeChange = (dates: Array<Date>) => {
    setDateRange(dates);
  };

  return (
    <div className={styles.datePickerWrapper}>
      <p>{t('dateRange', 'Date range')}:</p>
      <DatePicker
        locale="es"
        className={styles.dateRangePicker}
        dateFormat="d/m/Y"
        datePickerType="range"
        onChange={handleDateRangeChange}
        maxDate={currentDate.toISOString()}
        value={dateRange}
      >
        <DatePickerInput id="date-picker-input-id-start" labelText="" placeholder="dd/mm/yyyy" size="md" />
        <DatePickerInput id="date-picker-input-id-finish" labelText="" placeholder="dd/mm/yyyy" size="md" />
      </DatePicker>
    </div>
  );
};
