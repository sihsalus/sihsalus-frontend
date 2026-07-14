import { ContentSwitcher, NumberInput, Switch, TextInput } from '@carbon/react';
import { OpenmrsDatePicker } from '@openmrs/esm-framework';
import {
  calendarDateToLocalDate,
  getLocalCalendarDate,
  getOldestAllowedPatientBirthdate,
  normalizePatientAgeRange,
  shouldPreventPlainNumberKey,
  shouldPreventPlainNumberPaste,
} from '@openmrs/esm-utils';
import classNames from 'classnames';
import React from 'react';
import { type Control, Controller } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { type AdvancedPatientSearchState, type SearchFieldConfig } from '../../types';

import { PersonAttributeField } from './person-attribute-field.component';
import styles from './search-field.scss';

export function getOptionalIntegerInputValue(value: string | number) {
  if (value === '' || (typeof value === 'number' && Number.isNaN(value))) {
    return null;
  }

  return Number(value);
}

const preventInvalidIntegerKey = (event: React.KeyboardEvent<HTMLInputElement>) => {
  if (event.ctrlKey || event.metaKey || event.altKey) {
    return;
  }

  if (shouldPreventPlainNumberKey(event.key, { integer: true, nonNegative: true })) {
    event.preventDefault();
  }
};

const preventInvalidIntegerPaste = (min: number, max: number) => (event: React.ClipboardEvent<HTMLInputElement>) => {
  const text = event.clipboardData.getData('text');
  if (shouldPreventPlainNumberPaste(text, { integer: true, max, min, nonNegative: true })) {
    event.preventDefault();
  }
};

interface SearchFieldProps {
  field: SearchFieldConfig;
  control: Control<AdvancedPatientSearchState>;
  inTabletOrOverlay: boolean;
  isTablet: boolean;
}

const BirthdateSearchField: React.FC<Omit<SearchFieldProps, 'field'>> = ({ control, inTabletOrOverlay, isTablet }) => {
  const { t } = useTranslation();
  const referenceDate = getLocalCalendarDate();
  const oldestAllowedBirthdate = getOldestAllowedPatientBirthdate(referenceDate);

  return (
    <div className={classNames(styles.birthdateField, { [styles.fieldTabletOrOverlay]: inTabletOrOverlay })}>
      <Controller
        name="dateOfBirth"
        control={control}
        render={({ field: dayField, fieldState: dayState }) => (
          <Controller
            name="monthOfBirth"
            control={control}
            render={({ field: monthField, fieldState: monthState }) => (
              <Controller
                name="yearOfBirth"
                control={control}
                render={({ field: yearField, fieldState: yearState }) => {
                  const selectedDate =
                    dayField.value && monthField.value && yearField.value
                      ? calendarDateToLocalDate({
                          day: dayField.value,
                          month: monthField.value,
                          year: yearField.value,
                        })
                      : null;
                  const error = dayState.error ?? monthState.error ?? yearState.error;

                  return (
                    <OpenmrsDatePicker
                      id="dateOfBirth"
                      labelText={t('dateOfBirth', 'Date of birth')}
                      value={selectedDate}
                      onChange={(date) => {
                        const nextDate = date ? getLocalCalendarDate(date) : null;
                        dayField.onChange(nextDate?.day ?? null);
                        monthField.onChange(nextDate?.month ?? null);
                        yearField.onChange(nextDate?.year ?? null);
                      }}
                      minDate={oldestAllowedBirthdate ? calendarDateToLocalDate(oldestAllowedBirthdate) : undefined}
                      maxDate={calendarDateToLocalDate(referenceDate)}
                      invalid={!!error}
                      invalidText={error?.message}
                      size={isTablet ? 'lg' : 'md'}
                    />
                  );
                }}
              />
            )}
          />
        )}
      />
    </div>
  );
};

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
      return <BirthdateSearchField control={control} inTabletOrOverlay={inTabletOrOverlay} isTablet={isTablet} />;

    case 'age': {
      const { minimumAge: minAge, maximumAge: maxAge } = normalizePatientAgeRange(field.min, field.max);

      return (
        <div className={classNames({ [styles.fieldTabletOrOverlay]: inTabletOrOverlay })}>
          <Controller
            name="age"
            control={control}
            render={({ field: { onChange, value }, fieldState: { error } }) => (
              <NumberInput
                id={field.name}
                value={value ?? ''}
                onChange={(_event, { value: inputValue }) => onChange(getOptionalIntegerInputValue(inputValue))}
                onKeyDown={preventInvalidIntegerKey}
                onPaste={preventInvalidIntegerPaste(minAge, maxAge)}
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
