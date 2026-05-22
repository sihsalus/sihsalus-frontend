import { FormLabel, NumberInput, TextArea } from '@carbon/react';
import { Warning } from '@carbon/react/icons';
import { ResponsiveWrapper, useLayoutType } from '@openmrs/esm-framework';
import classNames from 'classnames';
import React, { Fragment, useId, useState } from 'react';
import type { Control, Path } from 'react-hook-form';
import { Controller } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import styles from './generic-input.scss';

type FieldTypes = 'number' | 'textarea';
type AbnormalValue = 'critically_low' | 'critically_high' | 'high' | 'low';

interface FormData {
  [key: string]: number | string | undefined;
}

interface GenericInputProps<T extends FormData> {
  control: Control<T>;
  fieldProperties: Array<{
    id: string;
    className?: string;
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

const GenericInput = <T extends FormData>({
  control,
  fieldProperties,
  fieldStyles,
  fieldWidth,
  interpretation,
  isValueWithinReferenceRange = true,
  label,
  placeholder,
  readOnly = false,
  showErrorMessage = false,
  unitSymbol,
}: GenericInputProps<T>): JSX.Element => {
  const { t } = useTranslation();
  const fieldId = useId();
  const isTablet = useLayoutType() === 'tablet';
  const [invalid, setInvalid] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const abnormalValues: AbnormalValue[] = ['critically_low', 'critically_high', 'high', 'low'];
  const hasAbnormalValue = !isFocused && interpretation && abnormalValues.includes(interpretation as AbnormalValue);

  function checkValidity(
    value: string,
    onChange: (value: number | undefined) => void,
    field: (typeof fieldProperties)[0],
  ): void {
    if (field.type === 'number' || !field.type) {
      const parsedValue = value === '' ? undefined : Number(value);
      const isOutOfRange =
        parsedValue !== undefined &&
        ((field.min !== null && parsedValue < field.min) || (field.max !== null && parsedValue > field.max));
      const isInvalid = parsedValue === undefined || Number.isNaN(parsedValue) || isOutOfRange;
      setInvalid(isInvalid);
      onChange(parsedValue);
    } else {
      onChange(value as unknown as number | undefined); // Cast value to match the expected type
    }
  }

  function handleFocusChange(isFocused: boolean): void {
    setIsFocused(isFocused);
  }

  const isInvalidInput = !isValueWithinReferenceRange || invalid;
  const showInvalidInputError = Boolean(showErrorMessage && isInvalidInput);

  const containerClasses = classNames(styles.container, {
    [styles.inputInTabletView]: isTablet,
    [styles.inputWithAbnormalValue]: hasAbnormalValue,
  });

  const inputClasses = classNames(styles.inputContainer, {
    [styles['critical-value']]: hasAbnormalValue,
    [styles.focused]: isFocused,
    [styles.readonly]: readOnly,
    [styles.invalidInput]: showInvalidInputError,
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

        <section className={inputClasses} style={fieldStyles}>
          <div
            className={classNames({
              [styles.centered]: !isTablet || unitSymbol === 'mmHg',
            })}
          >
            {fieldProperties.map((fieldProperty) => (
              <Fragment key={fieldProperty.id}>
                <ResponsiveWrapper>
                  <Controller
                    name={fieldProperty.id as Path<T>}
                    control={control}
                    render={({ field: { onChange, ref, value } }) => {
                      if (fieldProperty.type === 'number' || !fieldProperty.type) {
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
                            onChange={(event) => checkValidity(event.currentTarget.value, onChange, fieldProperty)}
                            onFocus={() => handleFocusChange(true)}
                            placeholder={placeholder} // Usar el prop directamente
                            readOnly={readOnly}
                            ref={ref}
                            style={fieldStyles}
                            title={fieldProperty.name}
                            value={value !== undefined ? (value as number) : ''}
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
                            onChange={(event) => checkValidity(event.currentTarget.value, onChange, fieldProperty)}
                            onFocus={() => handleFocusChange(true)}
                            placeholder={placeholder} // Usar el prop directamente
                            readOnly={readOnly}
                            ref={ref}
                            rows={2}
                            style={fieldStyles}
                            title={fieldProperty.name}
                            value={value !== undefined ? (value as string) : ''}
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
            {unitSymbol && <p className={styles.unitName}>{unitSymbol}</p>}
          </div>
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

export default GenericInput;
