import classNames from 'classnames';
import { Field } from 'formik';
import { type ChangeEvent, type ClipboardEvent, type KeyboardEvent, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { moduleName } from '../../../constants';
import { Input } from '../../input/basic-input/input/input.component';
import { type PersonAttributeTypeResponse } from '../../patient-registration.types';
import styles from './../field.scss';

export interface TextPersonAttributeFieldProps {
  id: string;
  personAttributeType: PersonAttributeTypeResponse;
  validationRegex?: string;
  label?: string;
  placeholder?: string;
  required?: boolean;
  readOnly?: boolean;
}

export function TextPersonAttributeField({
  id,
  personAttributeType,
  validationRegex,
  label,
  placeholder,
  required,
  readOnly,
}: TextPersonAttributeFieldProps) {
  const { t } = useTranslation(moduleName);
  const isPhoneField = id === 'phone' || id === 'mobilePhone';
  const sanitizePhoneInput = useCallback((value: string) => {
    const startsWithPlus = value.startsWith('+');
    const digits = value.replace(/\D/g, '');

    return `${startsWithPlus ? '+' : ''}${digits}`.slice(0, 20);
  }, []);

  const validateInput = (value: string) => {
    if (!value || !validationRegex || validationRegex === '' || typeof validationRegex !== 'string' || value === '') {
      return;
    }
    try {
      const regex = new RegExp(validationRegex);
      if (regex.test(value.trim())) {
        return;
      }
    } catch {
      return t('invalidFieldValidationConfig', 'This field has an invalid validation configuration');
    }

    return t('invalidInput', 'Invalid Input');
  };

  const fieldName = `attributes.${personAttributeType.uuid}`;

  return (
    <div className={classNames(styles.customField, styles.halfWidthInDesktopView)}>
      <Field name={fieldName} validate={validateInput}>
        {({ field, form: { setFieldValue } }) => {
          const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
            setFieldValue(fieldName, isPhoneField ? sanitizePhoneInput(event.target.value) : event.target.value);
          };
          const handlePaste = (event: ClipboardEvent<HTMLInputElement>) => {
            if (!isPhoneField) {
              return;
            }

            event.preventDefault();
            const input = event.currentTarget;
            const selectionStart = input.selectionStart ?? input.value.length;
            const selectionEnd = input.selectionEnd ?? selectionStart;
            const pastedValue = event.clipboardData.getData('text');
            const nextValue = `${input.value.slice(0, selectionStart)}${pastedValue}${input.value.slice(selectionEnd)}`;

            setFieldValue(fieldName, sanitizePhoneInput(nextValue));
          };
          const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
            if (event.metaKey || event.ctrlKey) {
              return;
            }

            if (!isPhoneField || event.key.length !== 1) {
              return;
            }

            if (/^\d$/.test(event.key)) {
              return;
            }

            const input = event.currentTarget;
            const isLeadingPlus =
              event.key === '+' && input.selectionStart === 0 && input.selectionEnd === 0 && !input.value.includes('+');

            if (!isLeadingPlus) {
              event.preventDefault();
            }
          };

          return (
            <Input
              id={id}
              name={`person-attribute-${personAttributeType.uuid}`}
              labelText={label ?? personAttributeType?.display}
              {...field}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              type={isPhoneField ? 'tel' : 'text'}
              inputMode={isPhoneField ? 'tel' : undefined}
              placeholder={placeholder}
              maxLength={isPhoneField ? 20 : undefined}
              helperText={isPhoneField ? t('phoneHelperText', 'Use digits, spaces or hyphens') : undefined}
              required={required}
              readOnly={readOnly}
            />
          );
        }}
      </Field>
    </div>
  );
}
