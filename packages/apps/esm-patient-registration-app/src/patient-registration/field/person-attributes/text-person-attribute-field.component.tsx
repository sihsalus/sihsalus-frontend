import classNames from 'classnames';
import { Field } from 'formik';
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
  required?: boolean;
}

export function TextPersonAttributeField({
  id,
  personAttributeType,
  validationRegex,
  label,
  required,
}: TextPersonAttributeFieldProps) {
  const { t } = useTranslation(moduleName);

  const validateInput = (value: string) => {
    if (!value || !validationRegex || validationRegex === '' || typeof validationRegex !== 'string' || value === '') {
      return;
    }
    try {
      const regex = new RegExp(validationRegex);
      if (regex.test(value)) {
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
        {({ field }) => {
          return (
            <Input
              id={id}
              name={`person-attribute-${personAttributeType.uuid}`}
              labelText={label ?? personAttributeType?.display}
              {...field}
              required={required}
            />
          );
        }}
      </Field>
    </div>
  );
}
