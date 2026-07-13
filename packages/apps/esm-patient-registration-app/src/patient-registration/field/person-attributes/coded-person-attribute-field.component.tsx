import { ComboBox, InlineNotification, Layer, Select, SelectItem } from '@carbon/react';
import { reportError, useSession, userHasAccess } from '@openmrs/esm-framework';
import classNames from 'classnames';
import { Field, getIn } from 'formik';
import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { moduleName } from '../../../constants';
import { type PersonAttributeTypeResponse } from '../../patient-registration.types';
import { isMissingConceptError, useConceptAnswers } from '../field.resource';
import styles from './../field.scss';

const getConceptsPrivilege = 'Get Concepts';

export interface CodedPersonAttributeFieldProps {
  id: string;
  personAttributeType: PersonAttributeTypeResponse;
  answerConceptSetUuid: string;
  label?: string;
  customConceptAnswers: Array<{ uuid: string; label?: string }>;
  required: boolean;
  searchable?: boolean;
  readOnly?: boolean;
  enforceAnswerSetMembership?: boolean;
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
  enforceAnswerSetMembership = false,
}: CodedPersonAttributeFieldProps) {
  const { user } = useSession();
  const hasCustomConceptAnswers = customConceptAnswers.length > 0;
  const canGetConcepts = userHasAccess(getConceptsPrivilege, user);
  const shouldLoadConceptAnswers = !hasCustomConceptAnswers && canGetConcepts && Boolean(answerConceptSetUuid);
  const {
    data: conceptAnswers,
    isLoading: isLoadingConceptAnswers,
    error: conceptAnswersError,
  } = useConceptAnswers(shouldLoadConceptAnswers ? answerConceptSetUuid : '');

  const isMissingAnswerSet = !answerConceptSetUuid && !hasCustomConceptAnswers;
  const isInvalidAnswerSet = !hasCustomConceptAnswers && canGetConcepts && isMissingConceptError(conceptAnswersError);
  const isEmptyAnswerSet =
    shouldLoadConceptAnswers && !isLoadingConceptAnswers && !conceptAnswersError && conceptAnswers?.length === 0;
  const cannotLoadConceptAnswers = !hasCustomConceptAnswers && (!canGetConcepts || Boolean(conceptAnswersError));

  const answers = useMemo(
    () =>
      hasCustomConceptAnswers
        ? customConceptAnswers
        : (conceptAnswers ?? [])
            .map((answer) => ({ ...answer, label: answer.display }))
            .sort((a, b) => a.label.localeCompare(b.label)),
    [hasCustomConceptAnswers, customConceptAnswers, conceptAnswers],
  );

  const { t } = useTranslation(moduleName);
  const fieldName = `attributes.${personAttributeType.uuid}`;
  const displayLabel = label ?? personAttributeType?.display;
  const labelText = required ? displayLabel : `${displayLabel} (${t('optional', 'optional')})`;
  const validateAnswerSetMembership = (value: unknown) => {
    if (!enforceAnswerSetMembership || !value || isLoadingConceptAnswers) {
      return undefined;
    }

    return typeof value === 'string' && answers.some((answer) => answer.uuid === value)
      ? undefined
      : t('selectValidConceptAnswer', 'Select a valid option from the configured catalog');
  };

  useEffect(() => {
    if (isMissingAnswerSet) {
      reportError(
        t(
          'codedPersonAttributeNoAnswerSet',
          `The person attribute field '{{codedPersonAttributeFieldId}}' is of type 'coded' but has been defined without an answer concept set UUID. The 'answerConceptSetUuid' key is required.`,
          { codedPersonAttributeFieldId: id },
        ),
      );
    }
  }, [id, isMissingAnswerSet, t]);

  useEffect(() => {
    if (isInvalidAnswerSet) {
      reportError(
        t(
          'codedPersonAttributeAnswerSetInvalid',
          `The coded person attribute field '{{codedPersonAttributeFieldId}}' has been defined with an invalid answer concept set UUID '{{answerConceptSetUuid}}'.`,
          { codedPersonAttributeFieldId: id, answerConceptSetUuid },
        ),
      );
    }
  }, [answerConceptSetUuid, id, isInvalidAnswerSet, t]);

  useEffect(() => {
    if (isEmptyAnswerSet) {
      reportError(
        t(
          'codedPersonAttributeAnswerSetEmpty',
          `The coded person attribute field '{{codedPersonAttributeFieldId}}' has been defined with an answer concept set UUID '{{answerConceptSetUuid}}' that does not have any concept answers.`,
          {
            codedPersonAttributeFieldId: id,
            answerConceptSetUuid,
          },
        ),
      );
    }
  }, [answerConceptSetUuid, id, isEmptyAnswerSet, t]);

  if (isMissingAnswerSet || isInvalidAnswerSet || isEmptyAnswerSet || cannotLoadConceptAnswers) {
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
          <Field name={fieldName} validate={validateAnswerSetMembership}>
            {({ field, form: { setFieldValue, touched, errors } }) => {
              const selectedAnswer = answers.find((answer) => answer.uuid === field.value) ?? null;
              const errorMessage = getIn(errors, fieldName);
              const invalid = Boolean(errorMessage && getIn(touched, fieldName));

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
                    invalidText={typeof errorMessage === 'string' ? errorMessage : undefined}
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
                  invalidText={typeof errorMessage === 'string' ? errorMessage : undefined}
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
