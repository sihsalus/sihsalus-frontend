import { SelectItem, TimePicker, TimePickerSelect } from '@carbon/react';
import { OpenmrsDatePicker, ResponsiveWrapper } from '@openmrs/esm-framework';
import { type amPm } from '@openmrs/esm-patient-common-lib';
import classNames from 'classnames';
import dayjs from 'dayjs';
import React from 'react';
import { type Control, Controller, type FieldPath, type FieldValues, useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import styles from './encounter-date-time.scss';

interface EncounterDateTimeSectionProps {
  control: Control<FieldValues>;
  firstEncounterDateTime?: number;
  patientUuid?: string;
  encounterTypeUuid?: string;
  sectionTitle?: string;
}

interface EncounterDateTimeFieldProps {
  dateField: Field;
  timeField?: Field;
  timeFormatField?: Field;
  minDate?: dayjs.ConfigType;
  maxDate?: dayjs.ConfigType;
  disabled?: boolean;
  control?: Control<FieldValues>;
  showTimeFields?: boolean;
}

interface Field {
  name: FieldPath<FieldValues>;
  label: string;
}

/**
 * The component conditionally renders the Visit start and end
 * date / time fields based on the visit status (new / ongoing / past)
 */
const EncounterDateTimeSection: React.FC<EncounterDateTimeSectionProps> = ({ control, sectionTitle }) => {
  const { t } = useTranslation();

  return (
    <section>
      <div className={styles.sectionTitle}>
        {sectionTitle || t('controlStartDateTime', 'Fecha y Hora de Inicio del control')}
      </div>
      <EncounterDateTimeField
        dateField={{ name: 'visitStartDate', label: t('startDate', 'Start date') }}
        timeField={{ name: 'visitStartTime', label: t('startTime', 'Start time') }}
        timeFormatField={{ name: 'visitStartTimeFormat', label: t('startTimeFormat', 'Start time format') }}
        maxDate={Date.now()}
        showTimeFields={true}
        control={control}
      />
    </section>
  );
};

/**
 * This components renders a DatePicker, TimePicker and AM / PM dropdown
 * used to input a Date.
 * It is used by the visit form for the start and end time inputs.
 */
const EncounterDateTimeField: React.FC<EncounterDateTimeFieldProps> = ({
  dateField,
  timeField,
  timeFormatField,
  minDate,
  maxDate,
  disabled,
  control: externalControl,
  showTimeFields = false,
}) => {
  const {
    control: contextControl,
    formState: { errors },
  } = useFormContext() || { control: undefined, formState: { errors: {} } };

  const control = externalControl || contextControl;
  const { t } = useTranslation();

  // Since we have the separate date and time fields, the full validation is done by zod.
  // We are just using minDateObj and maxDateObj to restrict the bounds of the DatePicker.
  const minDateObj = minDate ? dayjs(minDate).startOf('day') : null;
  const maxDateObj = maxDate ? dayjs(maxDate).endOf('day') : null;

  // Get current date and time for default values
  const now = new Date();

  const currentTimeFormat = now.getHours() >= 12 ? 'PM' : 'AM';
  const currentTime12Hour = now
    .toLocaleTimeString('en-US', {
      hour12: true,
      hour: '2-digit',
      minute: '2-digit',
    })
    .split(' ')[0];

  return (
    <div className={classNames(styles.dateTimeSection, styles.sectionField)}>
      <Controller
        name={dateField.name}
        control={control}
        render={({ field, fieldState }) => (
          <ResponsiveWrapper>
            <OpenmrsDatePicker
              {...field}
              value={(field.value as Date) || now}
              className={styles.datePicker}
              id={`${dateField.name}Input`}
              data-testid={`${dateField.name}Input`}
              maxDate={maxDateObj}
              minDate={minDateObj}
              labelText={dateField.label}
              invalid={Boolean(fieldState?.error?.message)}
              invalidText={fieldState?.error?.message}
              isDisabled={disabled}
            />
          </ResponsiveWrapper>
        )}
      />

      {showTimeFields && timeField && timeFormatField && (
        <ResponsiveWrapper>
          <Controller
            name={timeField.name}
            control={control}
            render={({ field: { onBlur, onChange, value } }) => (
              <div className={styles.timePickerContainer}>
                <TimePicker
                  className={styles.timePicker}
                  id={timeField.name}
                  invalid={Boolean(errors[timeField.name])}
                  invalidText={errors[timeField.name]?.message}
                  labelText={timeField.label}
                  onBlur={onBlur}
                  onChange={(event) => onChange(event.target.value as amPm)}
                  pattern="^(0[1-9]|1[0-2]):([0-5][0-9])$"
                  value={value || currentTime12Hour}
                  disabled={disabled}
                >
                  <Controller
                    name={timeFormatField.name}
                    control={control}
                    render={({ field: { onChange, value } }) => (
                      <TimePickerSelect
                        aria-label={timeFormatField.label}
                        className={classNames({
                          [styles.timePickerSelectError]: errors[timeFormatField.name],
                        })}
                        id={`${timeFormatField.name}Input`}
                        onChange={(event) => onChange(event.target.value as amPm)}
                        value={value || currentTimeFormat}
                        disabled={disabled}
                      >
                        <SelectItem value="AM" text={t('AM', 'AM')} />
                        <SelectItem value="PM" text={t('PM', 'PM')} />
                      </TimePickerSelect>
                    )}
                  />
                </TimePicker>
                {errors[timeFormatField.name] && (
                  <div className={styles.timerPickerError}>{errors[timeFormatField.name]?.message}</div>
                )}
              </div>
            )}
          />
        </ResponsiveWrapper>
      )}
    </div>
  );
};

export default EncounterDateTimeSection;
export { EncounterDateTimeField };
