import { ContentSwitcher, NumberInput, Select, SelectItem, Switch, TextInput } from '@carbon/react';
import { normalizePatientAgeRange, shouldPreventPlainNumberKey, shouldPreventPlainNumberPaste } from '@openmrs/esm-utils';
import classNames from 'classnames';
import React from 'react';
import { type Control, Controller } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { type AdvancedPatientSearchState, type PatientAgeUnit, type SearchFieldConfig } from '../../types';
import { MAX_PATIENT_AGE_DAYS, MAX_PATIENT_AGE_MONTHS } from '../patient-age-filter';

import { PersonAttributeField } from './person-attribute-field.component';
import styles from './search-field.scss';

export function getOptionalIntegerInputValue(value: string | number) {
  if (value === '' || (typeof value === 'number' && Number.isNaN(value))) {
    return null;
  }

  return Number(value);
}

export function getAgeInputRange(unit: PatientAgeUnit, minimumYears?: number, maximumYears?: number) {
  if (unit === 'days') {
    return { min: 0, max: MAX_PATIENT_AGE_DAYS };
  }
  if (unit === 'months') {
    return { min: 0, max: MAX_PATIENT_AGE_MONTHS };
  }

  const { minimumAge, maximumAge } = normalizePatientAgeRange(minimumYears, maximumYears);
  return { min: minimumAge, max: maximumAge };
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
                  id="gender-secondary"
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

    case 'age':
      return (
        <div className={classNames(styles.ageField, { [styles.fieldTabletOrOverlay]: inTabletOrOverlay })}>
          <Controller
            name="ageUnit"
            control={control}
            render={({ field: unitField }) => {
              const unit = unitField.value ?? 'years';
              const { min, max } = getAgeInputRange(unit, field.min, field.max);

              return (
                <>
                  <Controller
                    name="age"
                    control={control}
                    render={({ field: ageField, fieldState: { error } }) => (
                      <NumberInput
                        id={field.name}
                        value={ageField.value ?? ''}
                        onChange={(_event, { value }) => ageField.onChange(getOptionalIntegerInputValue(value))}
                        onKeyDown={preventInvalidIntegerKey}
                        onPaste={preventInvalidIntegerPaste(min, max)}
                        type="number"
                        label={t('age', 'Age')}
                        invalid={!!error}
                        invalidText={error?.message}
                        min={min}
                        max={max}
                        allowEmpty
                        hideSteppers
                        size={isTablet ? 'lg' : 'md'}
                        placeholder={field.placeholder}
                      />
                    )}
                  />
                  <Select
                    id="age-unit"
                    labelText={t('ageUnit', 'Unit')}
                    value={unit}
                    onChange={(event) => unitField.onChange(event.target.value as PatientAgeUnit)}
                    size={isTablet ? 'lg' : 'md'}
                  >
                    <SelectItem value="days" text={t('days', 'Days')} />
                    <SelectItem value="months" text={t('months', 'Months')} />
                    <SelectItem value="years" text={t('years', 'Years')} />
                  </Select>
                </>
              );
            }}
          />
        </div>
      );

    case 'activeVisit':
      return (
        <Controller
          name="activeVisitStatus"
          control={control}
          render={({ field: { onChange, value } }) => (
            <Select
              id="active-visit-status"
              labelText={t('consultationStatus', 'Consultation status')}
              onChange={(event) => onChange(event.target.value)}
              size={isTablet ? 'lg' : 'md'}
              value={value}
            >
              <SelectItem value="any" text={t('anyConsultationStatus', 'Any status')} />
              <SelectItem value="active" text={t('withActiveConsultation', 'With active consultation')} />
              <SelectItem value="inactive" text={t('withoutActiveConsultation', 'Without active consultation')} />
            </Select>
          )}
        />
      );

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
                onChange={(event: React.ChangeEvent<HTMLInputElement>) => onChange(event.currentTarget.value)}
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
