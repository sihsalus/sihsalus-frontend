import { DatePicker, DatePickerInput, Select, SelectItem } from '@carbon/react';
import { useAppContext } from '@openmrs/esm-framework';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';

import { type DateFilterContext, type FuaDateFilterMode } from '../types';

import styles from './fua-date-range-picker.scss';

export const FuaDateRangePicker = () => {
  const { t } = useTranslation();
  const currentDate = new Date();

  const { dateRange, setDateRange, dateFilterMode, setDateFilterMode } = useAppContext<DateFilterContext>(
    'fua-date-filter',
  ) ?? {
    dateRange: [dayjs().startOf('day').toDate(), new Date()],
    setDateRange: () => {},
    dateFilterMode: 'none' as FuaDateFilterMode,
    setDateFilterMode: () => {},
  };

  const handleDateRangeChange = (dates: Array<Date>) => {
    setDateRange(dates);
  };

  return (
    <div className={styles.datePickerWrapper}>
      <span className={styles.filterLabel}>{t('date', 'Fecha')}:</span>
      <Select
        id="fua-date-filter-mode"
        hideLabel
        labelText={t('filterDateBy', 'Filtrar fecha por')}
        size="md"
        value={dateFilterMode}
        onChange={(event) => setDateFilterMode(event.target.value as FuaDateFilterMode)}
      >
        <SelectItem value="none" text={t('noDateFilter', 'Sin filtro de fecha')} />
        <SelectItem value="created" text={t('creationDate', 'Fecha de Creacion')} />
        <SelectItem value="updated" text={t('fuaUpdatedAt', 'Fecha de Actualizacion')} />
        <SelectItem value="both" text={t('bothDates', 'Ambas fechas')} />
      </Select>
      <DatePicker
        className={styles.dateRangePicker}
        dateFormat="d/m/Y"
        datePickerType="range"
        maxDate={currentDate.toISOString()}
        onChange={handleDateRangeChange}
        value={dateRange}
      >
        <DatePickerInput
          disabled={dateFilterMode === 'none'}
          id="date-picker-input-id-start"
          labelText=""
          placeholder="dd/mm/yyyy"
          size="md"
        />
        <DatePickerInput
          disabled={dateFilterMode === 'none'}
          id="date-picker-input-id-finish"
          labelText=""
          placeholder="dd/mm/yyyy"
          size="md"
        />
      </DatePicker>
    </div>
  );
};
