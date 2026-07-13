import { ContentSwitcher, NumberInput, Switch, TextInput } from '@carbon/react';
import {
  shouldPreventPlainNumberKey,
  shouldPreventPlainNumberPaste,
  validatePlainNumberInput,
} from '@openmrs/esm-utils';
import classNames from 'classnames';
import React from 'react';
import { type Control, Controller } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { type AdvancedPatientSearchState, type SearchFieldConfig } from '../../types';

import { PersonAttributeField } from './person-attribute-field.component';
import { MAX_PATIENT_AGE, MIN_PATIENT_AGE } from './refine-search.validation';
import styles from './search-field.scss';

export function isValidIntegerInput(value: string | number, max?: number, maxLength?: number, min = 0) {
  const stringValue = String(value);
  if (!stringValue) {
    return true;
  }

  if (maxLength && stringValue.length > maxLength) {
    return false;
  }

  return !validatePlainNumberInput(stringValue, {
    integer: true,
    max,
    min,
    nonNegative: min >= 0,
  }).isInvalid;
}

export const getIntegerInputValue = (
  currentValue: string | number,
  nextValue: string | number,
  max?: number,
  maxLength?: number,
  min = 0,
) => {
  if (!isValidIntegerInput(nextValue, max, maxLength, min)) {
    return typeof currentValue === 'number' ? currentValue : Number(currentValue) || 0;
  }

  return nextValue === '' ? 0 : Number(nextValue);
};

const preventInvalidIntegerKey =
  (max?: number, maxLength?: number, min = 0) =>
  (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }

    if (shouldPreventPlainNumberKey(event.key, { integer: true, nonNegative: true })) {
      event.preventDefault();
      return;
    }

    if (!/^\d$/.test(event.key)) {
      return;
    }

    const input = event.currentTarget;
    const selectionStart = input.selectionStart ?? input.value.length;
    const selectionEnd = input.selectionEnd ?? selectionStart;
    const nextValue = `${input.value.slice(0, selectionStart)}${event.key}${input.value.slice(selectionEnd)}`;

    if (!isValidIntegerInput(nextValue, max, maxLength, min)) {
      event.preventDefault();
    }
  };

const preventInvalidIntegerPaste =
  (max?: number, maxLength?: number, min = 0) =>
  (event: React.ClipboardEvent<HTMLInputElement>) => {
    const text = event.clipboardData.getData('text');
    if (maxLength && text.length > maxLength) {
      event.preventDefault();
      return;
    }

    if (shouldPreventPlainNumberPaste(text, { integer: true, max, min, nonNegative: min >= 0 })) {
      event.preventDefault();
    }
  };

const sanitizeIntegerInput =
  (currentValue: string | number, max?: number, maxLength?: number, min = 0) =>
  (event: React.FormEvent<HTMLInputElement>) => {
    if (!isValidIntegerInput(event.currentTarget.value, max, maxLength, min)) {
      event.currentTarget.value = currentValue ? String(currentValue) : '';
    }
  };

interface SearchFieldProps {
  field: SearchFieldConfig;
  control: Control<AdvancedPatientSearchState>;
  inTabletOrOverlay: boolean;
  isTablet: boolean;
}

export const SearchField: React.FC<SearchFieldProps> = ({ field, control, inTabletOrOverlay, isTablet }) => {
  const { t } = useTranslation();

  switch (field.type) {
    case 'gender':
      return (
        <div className={classNames(styles.genderField, { [styles.fieldTabletOrOverlay]: inTabletOrOverlay })}>
          <div className={styles.labelText}>
            <label className={classNames(styles.sexLabelText, styles.label01)} htmlFor="gender">
              {t('sex', 'Sex')}
            </label>
          </div>
          <Controller
            name="gender"
            control={control}
            render={({ field: { onChange, value } }) => (
              <>
                <ContentSwitcher
                  id="gender"
                  size={isTablet ? 'lg' : 'md'}
                  onChange={({ name }) => onChange(name)}
                  selectedIndex={['any', 'male', 'female'].indexOf(value)}
                >
                  <Switch name="any" text={t('any', 'Any')} />
                  <Switch name="male" text={t('male', 'Male')} />
                  <Switch name="female" text={t('female', 'Female')} />
                </ContentSwitcher>
                <ContentSwitcher
                  id="gender"
                  size={isTablet ? 'lg' : 'md'}
                  onChange={({ name }) => onChange(name)}
                  selectedIndex={['other', 'unknown'].indexOf(value)}
                >
                  <Switch name="other" text={t('other', 'Other')} />
                  <Switch name="unknown" text={t('unknown', 'Unknown')} />
                </ContentSwitcher>
              </>
            )}
          />
        </div>
      );

    case 'dateOfBirth':
      return (
        <div className={classNames(styles.dobFields, { [styles.fieldTabletOrOverlay]: inTabletOrOverlay })}>
          <Controller
            name="dateOfBirth"
            control={control}
            render={({ field: { onChange, value }, fieldState: { error } }) => (
              <NumberInput
                id="dateOfBirth"
                placeholder="DD"
                value={value || ''}
                onChange={(_event, { value: inputValue }) =>
                  onChange(getIntegerInputValue(value, inputValue, 31, 2, 1))
                }
                onInput={sanitizeIntegerInput(value, 31, 2, 1)}
                onKeyDown={preventInvalidIntegerKey(31, 2, 1)}
                onPaste={preventInvalidIntegerPaste(31, 2, 1)}
                className={styles.dobField}
                type="number"
                label={t('dayOfBirth', 'Day of Birth')}
                invalid={!!error}
                invalidText={error?.message}
                min={1}
                max={31}
                allowEmpty
                hideSteppers
                size={isTablet ? 'lg' : 'md'}
              />
            )}
          />
          <Controller
            name="monthOfBirth"
            control={control}
            render={({ field: { onChange, value }, fieldState: { error } }) => (
              <NumberInput
                id="monthOfBirth"
                placeholder="MM"
                value={value || ''}
                onChange={(_event, { value: inputValue }) =>
                  onChange(getIntegerInputValue(value, inputValue, 12, 2, 1))
                }
                onInput={sanitizeIntegerInput(value, 12, 2, 1)}
                onKeyDown={preventInvalidIntegerKey(12, 2, 1)}
                onPaste={preventInvalidIntegerPaste(12, 2, 1)}
                className={styles.dobField}
                type="number"
                label={t('monthOfBirth', 'Month of Birth')}
                invalid={!!error}
                invalidText={error?.message}
                min={1}
                max={12}
                allowEmpty
                hideSteppers
                size={isTablet ? 'lg' : 'md'}
              />
            )}
          />
          <Controller
            name="yearOfBirth"
            control={control}
            render={({ field: { onChange, value }, fieldState: { error } }) => {
              const currentYear = new Date().getFullYear();
              const earliestBirthYear = currentYear - MAX_PATIENT_AGE;

              return (
                <NumberInput
                  id="yearOfBirth"
                  placeholder="YYYY"
                  value={value || ''}
                  onChange={(_event, { value: inputValue }) =>
                    onChange(getIntegerInputValue(value, inputValue, currentYear, 4, earliestBirthYear))
                  }
                  onInput={sanitizeIntegerInput(value, currentYear, 4)}
                  onKeyDown={preventInvalidIntegerKey(currentYear, 4)}
                  onPaste={preventInvalidIntegerPaste(currentYear, 4, earliestBirthYear)}
                  className={styles.dobField}
                  type="number"
                  label={t('yearOfBirth', 'Year of Birth')}
                  invalid={!!error}
                  invalidText={error?.message}
                  allowEmpty
                  hideSteppers
                  min={earliestBirthYear}
                  max={currentYear}
                  size={isTablet ? 'lg' : 'md'}
                />
              );
            }}
          />
        </div>
      );

    case 'age': {
      const minAge = field.min ?? MIN_PATIENT_AGE;
      const maxAge = field.max ?? MAX_PATIENT_AGE;

      return (
        <div className={classNames({ [styles.fieldTabletOrOverlay]: inTabletOrOverlay })}>
          <Controller
            name="age"
            control={control}
            render={({ field: { onChange, value }, fieldState: { error } }) => (
              <NumberInput
                id={field.name}
                value={value || ''}
                onChange={(_event, { value: inputValue }) =>
                  onChange(getIntegerInputValue(value, inputValue, maxAge, String(maxAge).length, minAge))
                }
                onInput={sanitizeIntegerInput(value, maxAge, String(maxAge).length, minAge)}
                onKeyDown={preventInvalidIntegerKey(maxAge, String(maxAge).length, minAge)}
                onPaste={preventInvalidIntegerPaste(maxAge, String(maxAge).length, minAge)}
                type="number"
                label={t('age', 'Age')}
                invalid={!!error}
                invalidText={error?.message}
                min={minAge}
                max={maxAge}
                allowEmpty
                hideSteppers
                size={isTablet ? 'lg' : 'md'}
                placeholder={field.placeholder}
              />
            )}
          />
        </div>
      );
    }

    case 'postcode':
      return (
        <div className={classNames({ [styles.fieldTabletOrOverlay]: inTabletOrOverlay })}>
          <Controller
            name="postcode"
            control={control}
            render={({ field: { onChange, value } }) => (
              <TextInput
                id={field.name}
                labelText={t('postcode', 'Postcode')}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.currentTarget.value)}
                value={value}
                size={isTablet ? 'lg' : 'md'}
                placeholder={field.placeholder}
              />
            )}
          />
        </div>
      );

    case 'personAttribute':
      return (
        <div className={classNames({ [styles.fieldTabletOrOverlay]: inTabletOrOverlay })}>
          <PersonAttributeField
            field={field}
            control={control}
            inTabletOrOverlay={inTabletOrOverlay}
            isTablet={isTablet}
          />
        </div>
      );
  }
};
