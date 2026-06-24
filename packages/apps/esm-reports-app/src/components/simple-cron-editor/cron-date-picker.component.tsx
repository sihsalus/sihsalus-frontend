import { DatePicker, DatePickerInput } from '@carbon/react';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import styles from './simple-cron-editor.scss';

interface CronDatePickerProps {
  value: Date;
  onChange: (date: Date) => void;
}

interface ValidationState {
  invalid: boolean;
  invalidText: string | null;
}

const CronDatePicker: React.FC<CronDatePickerProps> = ({ value, onChange }) => {
  const { t } = useTranslation();
  const [valueInternal, setValueInternal] = useState(value);
  const [validationState, setValidationState] = useState<ValidationState>({
    invalid: false,
    invalidText: null,
  });

  const validate = useCallback(() => {
    if (valueInternal instanceof Date) {
      setValidationState({ invalid: false, invalidText: null });
      onChange(valueInternal);
    } else {
      setValidationState({ invalid: true, invalidText: t('dateRequired', 'Required') });
      onChange(null);
    }
  }, [t, valueInternal, onChange]);

  useEffect(() => {
    setValueInternal(value);
  }, [value]);

  useEffect(() => {
    validate();
  }, [validate]);

  return (
    <div>
      <DatePicker
        datePickerType="single"
        value={valueInternal}
        onChange={([selectedDate]) => {
          setValueInternal(selectedDate);
        }}
      >
        <DatePickerInput
          id="cronDatePicker"
          labelText=""
          hideLabel
          invalid={validationState.invalid}
          invalidText={validationState.invalidText ? t(validationState.invalidText) : undefined}
        />
      </DatePicker>
      {validationState.invalid && (
        <span className={styles.dangerLabel01}>{validationState.invalidText && t(validationState.invalidText)}</span>
      )}
    </div>
  );
};

export default CronDatePicker;
