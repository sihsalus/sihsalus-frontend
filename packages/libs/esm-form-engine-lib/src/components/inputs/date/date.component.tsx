import { Layer, TimePicker } from '@carbon/react';
import { OpenmrsDatePicker } from '@openmrs/esm-styleguide';
import classNames from 'classnames';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useFormProviderContext } from '../../../provider/form-provider';
import { type FormFieldInputProps } from '../../../types';
import { isTrue } from '../../../utils/boolean-utils';
import { formatDateAsDisplayString } from '../../../utils/common-utils';
import { shouldUseInlineLayout } from '../../../utils/form-helper';
import { isEmpty } from '../../../validators/form-validator';
import FieldLabel from '../../field-label/field-label.component';
import FieldValueView from '../../value/view/field-value-view.component';
import styles from './date.scss';

type DateFieldValue = Date | string | null | undefined;

const DateField: React.FC<FormFieldInputProps<DateFieldValue>> = ({
  field,
  value: dateValue,
  errors,
  warnings,
  setFieldValue,
}) => {
  const { t } = useTranslation();
  const [time, setTime] = useState('');
  const { layoutType, sessionMode, workspaceLayout } = useFormProviderContext();
  const isInline = useMemo(() => {
    if (['view', 'embedded-view'].includes(sessionMode) || isTrue(field.readonly)) {
      return shouldUseInlineLayout(field.inlineRendering, layoutType, workspaceLayout, sessionMode);
    }
    return false;
  }, [sessionMode, field.readonly, field.inlineRendering, layoutType, workspaceLayout]);

  const setTimeIfPresent = useCallback((date: Date, time: string) => {
    if (!isEmpty(time)) {
      const [hours, minutes] = time.split(':').map(Number);
      date.setHours(hours ?? 0, minutes ?? 0);
    }
  }, []);

  const onDateChange = useCallback(
    (date: Date) => {
      setTimeIfPresent(date, time);
      setFieldValue(date);
    },
    [setFieldValue, setTimeIfPresent, time],
  );

  const onTimeChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const time = event.target.value;
      setTime(time);
      // TODO: Confirm if a new date should be instantiated when the date picker format is 'timer'
      // If the underlying concept's datatype is 'Time', then the backend expects a time string
      const date =
        field.datePickerFormat === 'timer'
          ? new Date()
          : dateValue instanceof Date || typeof dateValue === 'string'
            ? new Date(dateValue)
            : new Date();
      setTimeIfPresent(date, time);
      setFieldValue(date);
    },
    [field.datePickerFormat, setFieldValue, setTimeIfPresent, dateValue],
  );

  useEffect(() => {
    if (dateValue) {
      if (dateValue instanceof Date) {
        const hours = dateValue.getHours() < 10 ? `0${dateValue.getHours()}` : `${dateValue.getHours()}`;
        const minutes = dateValue.getMinutes() < 10 ? `0${dateValue.getMinutes()}` : `${dateValue.getMinutes()}`;
        setTime([hours, minutes].join(':'));
      }
    }
  }, [dateValue]);

  const timePickerLabel = useMemo(
    () =>
      field.datePickerFormat === 'timer' ? (
        <FieldLabel field={field} />
      ) : (
        <FieldLabel field={field} customLabel={t('time', 'Time')} />
      ),
    [field, t],
  );

  return sessionMode === 'view' || sessionMode === 'embedded-view' || isTrue(field.readonly) ? (
    <FieldValueView
      label={t(field.label)}
      value={dateValue instanceof Date ? formatDateAsDisplayString(field, dateValue) : dateValue}
      conceptName={field.meta?.concept?.display}
      isInline={isInline}
    />
  ) : (
    !field.isHidden && (
      <div className={styles.datetime}>
        {(field.datePickerFormat === 'calendar' || field.datePickerFormat === 'both') && (
          <div className={styles.datePickerSpacing}>
            <Layer>
              <div className={styles.datePickerLabel} id={`${field.id}-label`}>
                <FieldLabel field={field} />
              </div>
              <OpenmrsDatePicker id={field.id} onChange={onDateChange} value={dateValue} aria-label={t(field.label)} />
            </Layer>
            {warnings.length > 0 ? <div className={styles.datePickerWarn}>{warnings[0]?.message}</div> : null}
          </div>
        )}

        {field.datePickerFormat === 'both' || field.datePickerFormat === 'timer' ? (
          <div>
            <Layer>
              <TimePicker
                className={classNames(styles.boldedLabel, styles.timeInput)}
                id={field.id}
                labelText={timePickerLabel}
                placeholder="HH:MM"
                pattern="(1[012]|[1-9]):[0-5][0-9]$"
                type="time"
                disabled={field.datePickerFormat === 'timer' ? field.isDisabled : !dateValue ? true : false}
                invalid={errors.length > 0}
                invalidText={errors[0]?.message}
                readOnly={isTrue(field.readonly)}
                warning={warnings.length > 0}
                warningText={warnings[0]?.message}
                value={
                  time
                    ? time
                    : dateValue instanceof Date
                      ? dateValue.toLocaleDateString(window.navigator.language)
                      : dateValue
                }
                onChange={onTimeChange}
              />
            </Layer>
          </div>
        ) : null}
      </div>
    )
  );
};

export default DateField;
