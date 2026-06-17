import { Layer } from '@carbon/react';
import { OpenmrsDatePicker } from '@openmrs/esm-framework';
import classNames from 'classnames';
import dayjs from 'dayjs';
import { useField, useFormikContext } from 'formik';
import { useTranslation } from 'react-i18next';
import { moduleName } from '../../../constants';
import { type PersonAttributeTypeResponse } from '../../patient-registration.types';
import styles from './../field.scss';

export interface DatePersonAttributeFieldProps {
  id: string;
  personAttributeType: PersonAttributeTypeResponse;
  label?: string;
  required?: boolean;
  allowPastDates?: boolean;
  allowFutureDates?: boolean;
  readOnly?: boolean;
}

function parseDateOnlyValue(value: unknown) {
  if (!value || value instanceof Date) {
    return value as Date | null | undefined;
  }

  if (typeof value !== 'string') {
    return undefined;
  }

  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch;
    return new Date(Number(year), Number(month) - 1, Number(day));
  }

  const parsedDate = dayjs(value);
  return parsedDate.isValid() ? parsedDate.toDate() : undefined;
}

export function DatePersonAttributeField({
  id,
  personAttributeType,
  label,
  required,
  allowPastDates,
  allowFutureDates,
  readOnly,
}: DatePersonAttributeFieldProps) {
  const { t } = useTranslation(moduleName);
  const fieldName = `attributes.${personAttributeType.uuid}`;
  const [field, meta] = useField<string | Date | null | undefined>(fieldName);
  const { setFieldValue } = useFormikContext();
  const futureDatesAllowed = allowFutureDates ?? true;
  const pastDatesAllowed = allowPastDates ?? true;

  return (
    <div className={classNames(styles.customField, styles.halfWidthInDesktopView)}>
      <Layer>
        <OpenmrsDatePicker
          id={id}
          name={`person-attribute-${personAttributeType.uuid}`}
          labelText={label ?? personAttributeType.display}
          isRequired={required}
          invalid={!!(meta.touched && meta.error)}
          invalidText={meta.error ? t(meta.error) : undefined}
          isDisabled={readOnly}
          maxDate={!futureDatesAllowed ? new Date() : undefined}
          minDate={!pastDatesAllowed ? new Date() : undefined}
          onBlur={field.onBlur}
          onChange={(date) => setFieldValue(fieldName, date ? dayjs(date).format('YYYY-MM-DD') : '')}
          value={parseDateOnlyValue(field.value)}
        />
      </Layer>
    </div>
  );
}
