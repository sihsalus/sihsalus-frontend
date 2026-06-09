import { FormLabel, NumberInput, TextArea } from '@carbon/react';
import { Warning } from '@carbon/react/icons';
import { ResponsiveWrapper, useLayoutType } from '@openmrs/esm-framework';
import {
  parsePlainDecimalInput,
  preventScientificNotationKey,
  preventScientificNotationPaste,
} from '@sihsalus/esm-sihsalus-shared';
import classNames from 'classnames';
import React, { Fragment, useId, useState } from 'react';
import type { Control } from 'react-hook-form';
import { Controller } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { generatePlaceholder } from '../../common';
import type { NewbornVitalsFormType } from '../../common/data.resource';

import styles from './vitals-biometrics-input.scss';

type FieldId =
  | 'temperature' // was 'temperature'
  | 'oxygenSaturation' // was 'saturacionOxigeno'
  | 'systolicBloodPressure' // was 'presionSistolica'
  | 'respiratoryRate' // was 'frecuenciaRespiratoria'
  | 'weight' // was 'peso'
  | 'height' // was 'talla'
  | 'headCircumference' // was 'perimetroCefalico'
  | 'chestCircumference' // was 'perimetroToracico'
  | 'stoolCount' // was 'numeroDeposiciones'
  | 'stoolGrams' // was 'deposicionesGramos'
  | 'urineCount' // was 'numeroMicciones'
  | 'urineGrams' // was 'miccionesGramos'
  | 'vomitCount' // was 'numeroVomito'
  | 'vomitGramsML'; // was 'vomitoGramosML'

type AbnormalValue = 'critically_low' | 'critically_high' | 'high' | 'low';
type FieldTypes = 'number' | 'textarea';

interface NewbornVitalsInputProps {
  control: Control<NewbornVitalsFormType>;
  fieldProperties: Array<{
    id: FieldId;
    className?: string;
    invalid?: boolean;
    max?: number | null;
    min?: number | null;
    name: string;
    separator?: string;
    type?: FieldTypes;
  }>;
  label: string;
  fieldStyles?: React.CSSProperties;
  fieldWidth?: string;
  interpretation?: string;
  isValueWithinReferenceRange?: boolean;
  placeholder?: string;
  readOnly?: boolean;
  showErrorMessage?: boolean;
  unitSymbol?: string;
}

const NewbornVitalsInput: React.FC<NewbornVitalsInputProps> = ({
  control,
  fieldProperties,
  fieldStyles,
  fieldWidth,
  interpretation,
  isValueWithinReferenceRange = true,
  label,
  placeholder,
  readOnly,
  showErrorMessage,
  unitSymbol,
}) => {
  const { t } = useTranslation();
  const fieldId = useId();
  const isTablet = useLayoutType() === 'tablet';
  const [invalid, setInvalid] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const abnormalValues: AbnormalValue[] = ['critically_low', 'critically_high', 'high', 'low'];
  const hasAbnormalValue = !isFocused && interpretation && abnormalValues.includes(interpretation as AbnormalValue);

  function checkValidity(value, onChange) {
    const parsedValue = value === '' ? undefined : parsePlainDecimalInput(value);
    const isInvalid = value !== '' && parsedValue === undefined;
    setInvalid(isInvalid);
    if (!isInvalid) {
      onChange(parsedValue);
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
    [errorMessageClass]: true,
  });

  return (
    <>
      <div className={containerClasses} style={{ width: fieldWidth }}>
        <section className={styles.labelContainer}>
          <span className={styles.label}>{label}</span>

          {hasAbnormalValue && (
            <span className={styles[interpretation.replace('_', '-')]} title={t('abnormalValue', 'Valor anormal')} />
          )}

          {showInvalidInputError && (
            <span className={styles.invalidInputIcon}>
              <Warning />
            </span>
          )}
        </section>

        <section className={inputClasses} style={{ ...fieldStyles }}>
          <div
            className={classNames({
              [styles.centered]: !isTablet || unitSymbol === 'mmHg',
            })}
          >
            {fieldProperties.map((fieldProperty) => (
              <Fragment key={fieldProperty.id}>
                <ResponsiveWrapper>
                  <Controller
                    name={fieldProperty.id}
                    control={control}
                    render={({ field: { onChange, ref, value } }) => {
                      if (fieldProperty.type === 'number') {
                        return (
                          <NumberInput
                            allowEmpty
                            className={classNames(styles.numberInput, fieldProperty.className)}
                            defaultValue={''}
                            disableWheel
                            hideSteppers
                            id={`${fieldId}-${fieldProperty.id}`}
                            max={fieldProperty.max ?? undefined}
                            min={fieldProperty.min ?? undefined}
                            name={fieldProperty.name}
                            onBlur={() => handleFocusChange(false)}
                            onChange={(_event, { value }) => checkValidity(String(value ?? ''), onChange)}
                            onFocus={() => handleFocusChange(true)}
                            onKeyDown={preventScientificNotationKey}
                            onPaste={preventScientificNotationPaste}
                            placeholder={generatePlaceholder(fieldProperty.name)}
                            readOnly={readOnly}
                            ref={ref}
                            style={{ ...fieldStyles }}
                            title={fieldProperty.name}
                            value={value}
                          />
                        );
                      }

                      if (fieldProperty.type === 'textarea') {
                        return (
                          <TextArea
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
                            value={value}
                          />
                        );
                      }

                      return null;
                    }}
                  />
                </ResponsiveWrapper>
                {fieldProperty.separator}
              </Fragment>
            ))}
          </div>

          {unitSymbol && <p className={styles.unitName}>{unitSymbol}</p>}
        </section>
      </div>

      {showInvalidInputError && (
        <FormLabel className={styles.invalidInputError}>
          {t('validationInputError', `El valor debe estar entre {{min}} y {{max}}`, {
            min: fieldProperties[0].min,
            max: fieldProperties[0].max,
          })}
        </FormLabel>
      )}
    </>
  );
};

export default NewbornVitalsInput;
