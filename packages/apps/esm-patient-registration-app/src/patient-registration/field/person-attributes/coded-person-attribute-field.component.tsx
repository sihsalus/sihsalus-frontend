import { ComboBox, InlineNotification, Layer, Select, SelectItem } from '@carbon/react';
import classNames from 'classnames';
import { Field } from 'formik';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { moduleName } from '../../../constants';
import { type PersonAttributeTypeResponse } from '../../patient-registration.types';
import { useConceptAnswers } from '../field.resource';
import styles from './../field.scss';

export interface CodedPersonAttributeFieldProps {
  id: string;
  personAttributeType: PersonAttributeTypeResponse;
  answerConceptSetUuid: string;
  label?: string;
  customConceptAnswers: Array<{ uuid: string; label?: string }>;
  required: boolean;
  searchable?: boolean;
  readOnly?: boolean;
}

export function CodedPersonAttributeField({
  id,
  personAttributeType,
  answerConceptSetUuid,
  label,
  customConceptAnswers,
  required,
  searchable,
  readOnly,
}: CodedPersonAttributeFieldProps) {
  const {
    data: conceptAnswers,
    error: conceptAnswersError,
    isLoading: isLoadingConceptAnswers,
  } = useConceptAnswers(customConceptAnswers.length ? '' : answerConceptSetUuid);

  const { t } = useTranslation(moduleName);
  const fieldName = `attributes.${personAttributeType.uuid}`;
  const displayLabel = label ?? personAttributeType?.display;
  const labelText = required ? displayLabel : `${displayLabel} (${t('optional', 'optional')})`;
  const hasConfiguredAnswers = customConceptAnswers.length > 0;
  const isUnavailable =
    !hasConfiguredAnswers &&
    (!answerConceptSetUuid ||
      !!conceptAnswersError ||
      (!isLoadingConceptAnswers && (!conceptAnswers || conceptAnswers.length === 0)));

  const answers = useMemo(() => {
    if (customConceptAnswers.length) {
      return customConceptAnswers;
    }

    return isLoadingConceptAnswers || !conceptAnswers
      ? []
      : conceptAnswers
          .map((answer) => ({ ...answer, label: answer.display }))
          .sort((a, b) => a.label.localeCompare(b.label));
  }, [customConceptAnswers, conceptAnswers, isLoadingConceptAnswers]);

  if (isUnavailable) {
    return (
      <InlineNotification
        hideCloseButton
        kind={required ? 'error' : 'warning'}
        lowContrast
        title={t('codedPersonAttributeUnavailableTitle', 'No se pudo cargar {{field}}', {
          field: displayLabel,
        })}
        subtitle={
          required
            ? t(
                'codedPersonAttributeUnavailableRequired',
                'Este campo obligatorio no está disponible. Contacte al administrador del sistema.',
              )
            : t(
                'codedPersonAttributeUnavailableOptional',
                'Este campo opcional no está disponible por configuración. Puede continuar con el registro.',
              )
        }
      />
    );
  }

  return (
    <div
      className={classNames(styles.customField, styles.halfWidthInDesktopView, {
        [styles.searchableCodedField]: searchable,
      })}
    >
      {!isLoadingConceptAnswers ? (
        <Layer>
          <Field name={fieldName}>
            {({ field, form: { setFieldValue, touched, errors } }) => {
              const selectedAnswer = answers.find((answer) => answer.uuid === field.value) ?? null;
              const invalid = Boolean(errors[fieldName] && touched[fieldName]);

              if (searchable) {
                return (
                  <ComboBox
                    id={id}
                    items={answers}
                    itemToString={(answer) => answer?.label ?? ''}
                    selectedItem={selectedAnswer}
                    titleText={labelText}
                    placeholder={t('searchSelectAnOption', 'Search and select an option')}
                    invalid={invalid}
                    disabled={readOnly}
                    onChange={({ selectedItem }) => {
                      setFieldValue(fieldName, selectedItem?.uuid ?? '');
                    }}
                  />
                );
              }

              return (
                <Select
                  id={id}
                  name={`person-attribute-${personAttributeType.uuid}`}
                  labelText={labelText}
                  invalid={invalid}
                  required={required}
                  disabled={readOnly}
                  {...field}
                >
                  <SelectItem value={''} text={t('selectAnOption', 'Select an option')} />
                  {answers.map((answer) => (
                    <SelectItem key={answer.uuid} value={answer.uuid} text={answer.label} />
                  ))}
                </Select>
              );
            }}
          </Field>
        </Layer>
      ) : null}
    </div>
  );
}
