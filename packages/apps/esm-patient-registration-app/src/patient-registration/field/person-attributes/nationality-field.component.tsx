import { InlineNotification, Layer, Select, SelectItem, TextInputSkeleton } from '@carbon/react';
import classNames from 'classnames';
import { Field } from 'formik';
import { useContext, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { type FieldDefinition } from '../../../config-schema';
import { moduleName } from '../../../constants';
import { PatientRegistrationContext } from '../../patient-registration-context';
import styles from '../field.scss';
import { defaultNationalityCountryCode, getCountryOptions } from './country-options';
import { usePersonAttributeType } from './person-attributes.resource';

interface NationalityFieldProps {
  fieldDefinition: FieldDefinition;
}

export function NationalityField({ fieldDefinition }: NationalityFieldProps) {
  const { data: personAttributeType, isLoading, error } = usePersonAttributeType(fieldDefinition.uuid);
  const { inEditMode, setFieldValue, values } = useContext(PatientRegistrationContext);
  const { i18n, t } = useTranslation(moduleName);
  const countryOptions = useMemo(() => getCountryOptions(i18n.language), [i18n.language]);
  const fieldName = personAttributeType ? `attributes.${personAttributeType.uuid}` : null;
  const required = fieldDefinition.validation?.required ?? false;
  const displayLabel = fieldDefinition.label ?? personAttributeType?.display;
  const labelText = displayLabel;

  useEffect(() => {
    if (!fieldName || inEditMode || values.attributes?.[personAttributeType.uuid]) {
      return;
    }

    setFieldValue(fieldName, defaultNationalityCountryCode);
  }, [fieldName, inEditMode, personAttributeType?.uuid, setFieldValue, values.attributes]);

  if (isLoading) {
    return (
      <div className={classNames(styles.customField, styles.halfWidthInDesktopView)}>
        <TextInputSkeleton />
      </div>
    );
  }

  if (error || !personAttributeType || !fieldName) {
    return (
      <InlineNotification kind="error" title={t('error', 'Error')}>
        {t('unableToFetch', 'Unable to fetch person attribute type - {{personattributetype}}', {
          personattributetype: fieldDefinition?.label ?? fieldDefinition?.id,
        })}
      </InlineNotification>
    );
  }

  return (
    <div className={classNames(styles.customField, styles.halfWidthInDesktopView)} style={{ marginBottom: '1rem' }}>
      <Layer>
        <Field name={fieldName}>
          {({ field, form: { touched, errors } }) => (
            <Select
              id={fieldDefinition.id}
              name={`person-attribute-${personAttributeType.uuid}`}
              labelText={labelText}
              invalid={errors[fieldName] && touched[fieldName]}
              required={required}
              {...field}
              value={field.value || defaultNationalityCountryCode}
            >
              {countryOptions.map((country) => (
                <SelectItem key={country.code} value={country.code} text={country.label} />
              ))}
            </Select>
          )}
        </Field>
      </Layer>
    </div>
  );
}
