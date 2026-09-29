import { Layer, TextInput, type TextInputProps } from '@carbon/react';
import { useField } from 'formik';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { moduleName } from '../../../../constants';

export type { TextInputProps } from '@carbon/react';

interface InputProps extends TextInputProps {
  checkWarning?(value: string): string;
  name: string;
  validate?(value: unknown): string | undefined;
}

export const Input: React.FC<InputProps> = ({ checkWarning, validate, ...props }) => {
  const [field, meta] = useField({ name: props.name, validate });
  const { t } = useTranslation(moduleName);

  /*
    Do not remove these comments
    t('givenNameRequired')
    t('familyNameRequired')
    t('genderUnspecified')
    t('genderRequired')
    t('birthdayRequired')
    t('birthdayNotInTheFuture')
    t('negativeYears')
    t('negativeMonths')
    t('deathdayNotInTheFuture')
    t('invalidEmail')
    t('numberInNameDubious')
    t('yearsEstimateRequired')
    t('deathdayIsRequired', 'Death date is required when the patient is marked as deceased.')
    t('deathdayInvalidDate', 'Date of death is invalid')
    t('deathCauseRequired', 'Cause of death is required')
    t('nonCodedCauseOfDeathRequired', 'Non-coded cause of death is required')
  */

  const value = field.value || '';
  const invalidText = meta.error && t(meta.error);
  const warnText = useMemo(() => {
    if (!invalidText && typeof checkWarning === 'function') {
      const warning = checkWarning(value);
      return warning && t(warning);
    }

    return undefined;
  }, [checkWarning, invalidText, value, t]);

  const { required, ...textInputProps } = props;
  const labelText = required ? props.labelText : `${props.labelText} (${t('optional', 'optional')})`;

  return (
    <div style={{ marginBottom: '1rem' }}>
      <Layer>
        <TextInput
          {...field}
          {...textInputProps}
          aria-required={required || undefined}
          labelText={labelText}
          invalid={!!(meta.touched && meta.error)}
          invalidText={invalidText}
          warn={!!warnText}
          warnText={warnText}
          value={value}
        />
      </Layer>
    </div>
  );
};
