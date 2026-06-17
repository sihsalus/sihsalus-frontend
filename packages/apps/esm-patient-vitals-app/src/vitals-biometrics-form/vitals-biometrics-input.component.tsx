import { FormLabel, NumberInput, Select, SelectItem, TextArea } from '@carbon/react';
import { Warning } from '@carbon/react/icons';
import { ResponsiveWrapper, useLayoutType } from '@openmrs/esm-framework';
import { shouldPreventPlainNumberKey, shouldPreventPlainNumberPaste } from '@openmrs/esm-utils';
import classNames from 'classnames';
import React, { Fragment, useId, useState } from 'react';
import { type Control, Controller } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { generatePlaceholder } from '../common';

import { validateClinicalNumberInput } from './vitals-biometrics-form.utils';
import { type VitalsBiometricsFormData } from './vitals-biometrics-form.workspace';
import styles from './vitals-biometrics-input.scss';

type fieldId =
  | 'abdominalCircumference'
  | 'chestCircumference'
  | 'computedBodyMassIndex'
  | 'diastolicBloodPressure'
  | 'generalPatientNote'
  | 'glasgowEyeOpening'
  | 'glasgowMotorResponse'
  | 'glasgowTotal'
  | 'glasgowVerbalResponse'
  | 'headCircumference'
  | 'height'
  | 'midUpperArmCircumference'
  | 'oxygenSaturation'
  | 'pulse'
  | 'respiratoryRate'
  | 'systolicBloodPressure'
  | 'temperature'
  | 'weight';

type AbnormalValue = 'critically_low' | 'critically_high' | 'high' | 'low';
type FieldTypes = 'number' | 'select' | 'textarea';

interface SelectOption {
  label: string;
  value: number | string;
}

interface VitalsAndBiometricsInputProps {
  control: Control<VitalsBiometricsFormData>;
  fieldStyles?: React.CSSProperties;
  fieldWidth?: string;
  fieldProperties: Array<{
    className?: string;
    id: fieldId;
    integer?: boolean;
    invalid?: boolean;
    max?: number | null;
    min?: number | null;
    name: string;
    options?: Array<SelectOption>;
    separator?: string;
    type?: FieldTypes;
  }>;
  interpretation?: string;
  isValueWithinReferenceRange?: boolean;
  label: string;
  muacColorCode?: string;
  placeholder?: string;
  readOnly?: boolean;
  showErrorMessage?: boolean;
  unitSymbol?: string;
  useMuacColors?: boolean;
}

const VitalsAndBiometricsInput: React.FC<VitalsAndBiometricsInputProps> = ({
  control,
  fieldProperties,
  fieldStyles,
  fieldWidth,
  interpretation,
  isValueWithinReferenceRange = true,
  label,
  muacColorCode,
  placeholder,
  readOnly,
  showErrorMessage,
  unitSymbol,
  useMuacColors,
}) => {
  const { t } = useTranslation();
  const fieldId = useId();
  const isTablet = useLayoutType() === 'tablet';
  const [invalid, setInvalid] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const abnormalValues: Array<AbnormalValue> = ['critically_low', 'critically_high', 'high', 'low'];
  const hasAbnormalValue = !isFocused && interpretation && abnormalValues.includes(interpretation as AbnormalValue);

  function checkValidity(
    value: string,
    fieldProperty: VitalsAndBiometricsInputProps['fieldProperties'][number],
    onChange: (value: number | undefined) => void,
  ) {
    const { isInvalid, isInvalidFormat, parsedValue } = validateClinicalNumberInput(value, {
      integer: fieldProperty.integer,
      max: fieldProperty.max,
      min: fieldProperty.min,
    });

    setInvalid(isInvalid);

    if (!isInvalidFormat) {
      onChange(parsedValue);
    }
  }

  function preventInvalidNumberKey(
    event: React.KeyboardEvent<HTMLInputElement>,
    fieldProperty: VitalsAndBiometricsInputProps['fieldProperties'][number],
  ) {
    if (event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }

    if (shouldPreventPlainNumberKey(event.key, { integer: fieldProperty.integer, nonNegative: true })) {
      event.preventDefault();
    }
  }

  function preventInvalidNumberPaste(
    event: React.ClipboardEvent<HTMLInputElement>,
    fieldProperty: VitalsAndBiometricsInputProps['fieldProperties'][number],
  ) {
    const pastedValue = event.clipboardData.getData('text');
    if (
      shouldPreventPlainNumberPaste(pastedValue, {
        integer: fieldProperty.integer,
        max: fieldProperty.max,
        min: fieldProperty.min,
        nonNegative: true,
      })
    ) {
      event.preventDefault();
    }
  }

  function handleFocusChange(isFocused: boolean) {
    setIsFocused(isFocused);
  }

  const isInvalidInput = !isValueWithinReferenceRange || invalid;
  const showInvalidInputError = Boolean(showErrorMessage && isInvalidInput);
  const errorMessageClass = showInvalidInputError ? styles.invalidInput : '';

  const containerClasses = classNames(styles.container, {
    [styles.inputInTabletView]: isTablet,
    [styles.inputWithAbnormalValue]: hasAbnormalValue,
  });

  const inputClasses = classNames(styles.inputContainer, {
    [styles['critical-value']]: hasAbnormalValue,
    [styles.focused]: isFocused,
    [styles.readonly]: readOnly,
    [muacColorCode]: useMuacColors,
    [errorMessageClass]: true,
  });

  return (
    <>
      <div className={containerClasses} style={{ width: fieldWidth }}>
        <section className={styles.labelContainer}>
          <span className={styles.label}>{label}</span>

          {hasAbnormalValue ? (
            <span className={styles[interpretation.replace('_', '-')]} title={t('abnormalValue', 'Abnormal value')} />
          ) : null}

          {showInvalidInputError ? (
            <span className={styles.invalidInputIcon}>
              <Warning />
            </span>
          ) : null}
        </section>
        <section className={inputClasses} style={{ ...fieldStyles }}>
          <div
            className={classNames({
              [styles.centered]: !isTablet || unitSymbol === 'mmHg',
            })}
          >
            {fieldProperties.map((fieldProperty) => {
              if (fieldProperty.type === 'number') {
                const numberInputClasses = classNames(styles.numberInput, fieldProperty.className);

                return (
                  <Fragment key={fieldProperty.id}>
                    <ResponsiveWrapper>
                      <Controller
                        name={fieldProperty.id}
                        control={control}
                        render={({ field: { onChange, ref, value } }) => {
                          return (
                            <NumberInput
                              allowEmpty
                              className={numberInputClasses}
                              disableWheel
                              hideSteppers
                              id={`${fieldId}-${fieldProperty.id}`}
                              max={fieldProperty.max ?? undefined}
                              min={fieldProperty.min ?? undefined}
                              name={fieldProperty.name}
                              onBlur={() => handleFocusChange(false)}
                              onChange={(_event, { value }) =>
                                checkValidity(String(value ?? ''), fieldProperty, onChange)
                              }
                              onFocus={() => handleFocusChange(true)}
                              onKeyDown={(event) => preventInvalidNumberKey(event, fieldProperty)}
                              onPaste={(event) => preventInvalidNumberPaste(event, fieldProperty)}
                              placeholder={generatePlaceholder(fieldProperty.name)}
                              readOnly={readOnly}
                              ref={ref}
                              style={{ ...fieldStyles }}
                              step={fieldProperty.integer ? 1 : 0.1}
                              title={fieldProperty.name}
                              type="number"
                              value={value ?? ''}
                            />
                          );
                        }}
                      />
                    </ResponsiveWrapper>
                    {fieldProperty?.separator}
                  </Fragment>
                );
              }

              if (fieldProperty.type === 'textarea') {
                return (
                  <ResponsiveWrapper key={fieldProperty.id}>
                    <Controller
                      name={fieldProperty.id}
                      control={control}
                      render={({ field: { onChange, ref, value } }) => (
                        <TextArea
                          aria-label={fieldProperty.name}
                          className={styles.textarea}
                          id={`${fieldId}-${fieldProperty.id}`}
                          labelText=""
                          maxCount={100}
                          name={fieldProperty.name}
                          onBlur={() => handleFocusChange(false)}
                          onChange={onChange}
                          onFocus={() => handleFocusChange(true)}
                          placeholder={placeholder}
                          ref={ref}
                          rows={2}
                          style={{ ...fieldStyles }}
                          title={fieldProperty.name}
                          value={value ?? ''}
                        />
                      )}
                    />
                  </ResponsiveWrapper>
                );
              }

              if (fieldProperty.type === 'select') {
                return (
                  <ResponsiveWrapper key={fieldProperty.id}>
                    <Controller
                      name={fieldProperty.id}
                      control={control}
                      render={({ field: { onChange, ref, value } }) => (
                        <Select
                          aria-label={fieldProperty.name}
                          className={styles.selectInput}
                          disabled={readOnly}
                          id={`${fieldId}-${fieldProperty.id}`}
                          labelText=""
                          name={fieldProperty.name}
                          onBlur={() => handleFocusChange(false)}
                          onChange={(event) => {
                            const selectedValue = event.target.value;
                            onChange(selectedValue === '' ? undefined : selectedValue);
                          }}
                          onFocus={() => handleFocusChange(true)}
                          ref={ref}
                          title={fieldProperty.name}
                          value={value ?? ''}
                        >
                          <SelectItem value="" text={t('selectOption', 'Select an option')} />
                          {fieldProperty.options?.map((option) => (
                            <SelectItem key={option.value} value={option.value} text={option.label} />
                          ))}
                        </Select>
                      )}
                    />
                  </ResponsiveWrapper>
                );
              }

              return null;
            })}
          </div>
          {Boolean(unitSymbol) && <p className={styles.unitName}>{unitSymbol}</p>}
        </section>
      </div>

      {showInvalidInputError && (
        <FormLabel className={styles.invalidInputError}>
          {t('validationInputError', `Value must be between {{min}} and {{max}}`, {
            min: fieldProperties[0].min,
            max: fieldProperties[0].max,
          })}
        </FormLabel>
      )}
    </>
  );
};

export default VitalsAndBiometricsInput;
