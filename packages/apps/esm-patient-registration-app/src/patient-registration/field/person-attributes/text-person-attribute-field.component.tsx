import classNames from 'classnames';
import { Field } from 'formik';
import { type ChangeEvent, type ClipboardEvent, type KeyboardEvent, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { moduleName, personAttributeValueMaxLength } from '../../../constants';
import { Input } from '../../input/basic-input/input/input.component';
import { type PersonAttributeTypeResponse } from '../../patient-registration.types';
import styles from './../field.scss';

/** Show the character counter only once the user is close to the ceiling. */
const counterVisibilityRatio = 0.8;

export interface TextPersonAttributeFieldProps {
  id: string;
  personAttributeType: PersonAttributeTypeResponse;
  validationRegex?: string;
  maxLength?: number;
  label?: string;
  placeholder?: string;
  required?: boolean;
  readOnly?: boolean;
}

export function TextPersonAttributeField({
  id,
  personAttributeType,
  validationRegex,
  maxLength,
  label,
  placeholder,
  required,
  readOnly,
}: TextPersonAttributeFieldProps) {
  const { t } = useTranslation(moduleName);
  const isPhoneField = id === 'phone' || id === 'mobilePhone';
  const sanitizePhoneInput = useCallback(
    (value: string) => {
      const startsWithPlus = id === 'mobilePhone' && value.startsWith('+');
      const digits = value.replace(/\D/g, '');

      return `${startsWithPlus ? '+' : ''}${digits}`.slice(0, 20);
    },
    [id],
  );

  // Phone numbers are already capped while typing, so they never reach this.
  const effectiveMaxLength = isPhoneField
    ? undefined
    : Number.isFinite(maxLength) && maxLength > 0
      ? maxLength
      : personAttributeValueMaxLength;

  const validateInput = (value: string) => {
    // Length is checked before the regex: an over-long value cannot be saved at
    // all, so that is the more useful message even when the format is also off.
    if (effectiveMaxLength && value && value.length > effectiveMaxLength) {
      return t('personAttributeValueTooLong', 'Use {{max}} characters or fewer ({{count}} entered)', {
        count: value.length,
        max: effectiveMaxLength,
      });
    }

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
            const isLeadingMobilePlus =
              id === 'mobilePhone' &&
              event.key === '+' &&
              input.selectionStart === 0 &&
              input.selectionEnd === 0 &&
              !input.value.includes('+');

            if (!isLeadingMobilePlus) {
              event.preventDefault();
            }
          };

          // The counter is rendered as helper text rather than through Carbon's
          // `enableCounter`, which also applies a hard `maxLength` to the input.
          // A hard cap would silently drop characters from a pasted value, and
          // half an insurance number saved without warning is worse than an
          // error the user can see and correct.
          const currentLength = String(field.value ?? '').length;
          const showCounter =
            !!effectiveMaxLength && !readOnly && currentLength >= effectiveMaxLength * counterVisibilityRatio;
          const counterText = showCounter ? `${currentLength}/${effectiveMaxLength}` : undefined;
          const phoneHelperText =
            id === 'mobilePhone'
              ? t('mobilePhoneHelperText', 'Enter digits only. Use +51 when including the country code.')
              : id === 'phone'
                ? t('phoneHelperText', 'Enter digits only.')
                : undefined;

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
              helperText={[phoneHelperText, counterText].filter(Boolean).join(' · ') || undefined}
              required={required}
              readOnly={readOnly}
            />
          );
        }}
      </Field>
    </div>
  );
}
