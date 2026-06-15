import { NumberInput, Select, SelectItem, TextInput } from '@carbon/react';
import {
  type PlainNumberInputConstraints,
  shouldPreventPlainNumberKey,
  shouldPreventPlainNumberPaste,
  validatePlainNumberInput,
} from '@openmrs/esm-utils';
import React from 'react';
import { type Control, Controller, type FieldErrors } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { type Observation } from '../types/encounter';
import { isCoded, isNumeric, isPanel, isText, type LabOrderConcept } from './lab-results.resource';
import styles from './lab-results-form.scss';

interface ResultFormFieldProps {
  concept: LabOrderConcept;
  control: Control<Record<string, unknown>>;
  defaultValue: Observation;
  errors: FieldErrors;
}

const ResultFormField: React.FC<ResultFormFieldProps> = ({ concept, control, defaultValue, errors }) => {
  const { t } = useTranslation();

  const getErrorMessage = (fieldName: string) => {
    const message = errors[fieldName]?.message;
    return typeof message === 'string' ? message : undefined;
  };

  // TODO: Reference ranges should be dynamically adjusted based on patient demographics:
  // - Age-specific ranges (e.g., pediatric vs adult values)
  // - Gender-specific ranges where applicable
  const formatLabRange = (concept: LabOrderConcept) => {
    const hl7Abbreviation = concept?.datatype?.hl7Abbreviation;
    if (hl7Abbreviation !== 'NM') {
      return '';
    }

    const { hiAbsolute, lowAbsolute, units } = concept;
    const displayUnit = units ? ` ${units}` : '';

    const hasLowerLimit = lowAbsolute != null;
    const hasUpperLimit = hiAbsolute != null;

    if (hasLowerLimit && hasUpperLimit) {
      return ` (${lowAbsolute} - ${hiAbsolute} ${displayUnit})`;
    } else if (hasUpperLimit) {
      return ` (<= ${hiAbsolute} ${displayUnit})`;
    } else if (hasLowerLimit) {
      return ` (>= ${lowAbsolute} ${displayUnit})`;
    }
    return units ? ` (${displayUnit})` : '';
  };

  const getSavedMemberValue = (conceptUuid: string, dataType: string): string | number | undefined => {
    const savedValue =
      dataType === 'Coded'
        ? defaultValue?.groupMembers?.find((member) => member.concept.uuid === conceptUuid)?.value?.uuid
        : defaultValue?.groupMembers?.find((member) => member.concept.uuid === conceptUuid)?.value;

    return typeof savedValue === 'string' || typeof savedValue === 'number' ? savedValue : undefined;
  };

  const getNumberConstraints = (concept: LabOrderConcept): PlainNumberInputConstraints => ({
    integer: concept.allowDecimal === false,
    max: concept.hiAbsolute,
    min: concept.lowAbsolute,
    nonNegative: typeof concept.lowAbsolute === 'number' && concept.lowAbsolute >= 0,
  });

  const getNumericResultValue = (value: string | number, concept: LabOrderConcept) =>
    value === '' ? null : (validatePlainNumberInput(value, getNumberConstraints(concept)).parsedValue ?? null);

  const preventInvalidNumberKey = (concept: LabOrderConcept) => (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }

    if (shouldPreventPlainNumberKey(event.key, getNumberConstraints(concept))) {
      event.preventDefault();
    }
  };

  const preventInvalidNumberPaste = (concept: LabOrderConcept) => (event: React.ClipboardEvent<HTMLInputElement>) => {
    if (shouldPreventPlainNumberPaste(event.clipboardData.getData('text'), getNumberConstraints(concept))) {
      event.preventDefault();
    }
  };

  return (
    <>
      {isText(concept) && (
        <Controller
          control={control}
          name={concept.uuid}
          render={({ field }) => (
            <TextInput
              {...field}
              className={styles.textInput}
              id={concept.uuid}
              key={concept.uuid}
              labelText={`${concept?.display ? concept.display + ' ' : ''}${formatLabRange(concept)}`}
              type="text"
              value={typeof field.value === 'string' || typeof field.value === 'number' ? field.value : ''}
              invalidText={getErrorMessage(concept.uuid)}
              invalid={!!errors[concept.uuid]}
            />
          )}
        />
      )}

      {isNumeric(concept) && (
        <Controller
          control={control}
          name={concept.uuid}
          render={({ field }) => (
            <NumberInput
              allowEmpty
              className={styles.numberInput}
              disableWheel
              hideSteppers
              id={concept.uuid}
              key={concept.uuid}
              label={`${concept?.display ? concept.display + ' ' : ''}${formatLabRange(concept)}`}
              max={concept.hiAbsolute ?? undefined}
              min={concept.lowAbsolute ?? undefined}
              onChange={(_, { value }) => field.onChange(getNumericResultValue(value, concept))}
              onKeyDown={preventInvalidNumberKey(concept)}
              onPaste={preventInvalidNumberPaste(concept)}
              value={typeof field.value === 'number' ? field.value : ''}
              invalidText={getErrorMessage(concept.uuid)}
              invalid={!!errors[concept.uuid]}
            />
          )}
        />
      )}

      {isCoded(concept) && (
        <Controller
          name={concept.uuid}
          control={control}
          render={({ field }) => (
            <Select
              {...field}
              className={styles.textInput}
              defaultValue={defaultValue?.value?.uuid}
              id={`select-${concept.uuid}`}
              key={concept.uuid}
              labelText={`${concept?.display ? concept.display + ' ' : ''}${formatLabRange(concept)}`}
              value={typeof field.value === 'string' ? field.value : ''}
              invalidText={getErrorMessage(concept.uuid)}
              invalid={!!errors[concept.uuid]}
            >
              <SelectItem text={t('chooseAnOption', 'Choose an option')} value="" />
              {concept?.answers?.length &&
                concept?.answers?.map((answer) => (
                  <SelectItem key={answer.uuid} text={answer.display} value={answer.uuid}>
                    {answer.display}
                  </SelectItem>
                ))}
            </Select>
          )}
        />
      )}

      {isPanel(concept) &&
        concept.setMembers.map((member) => (
          <React.Fragment key={member.uuid}>
            {isText(member) && (
              <Controller
                control={control}
                name={member.uuid}
                render={({ field }) => (
                  <TextInput
                    {...field}
                    id={`text-${member.uuid}`}
                    className={styles.textInput}
                    key={member.uuid}
                    labelText={`${member?.display ? member.display + ' ' : ''}${formatLabRange(member)}`}
                    type="text"
                    value={typeof field.value === 'string' || typeof field.value === 'number' ? field.value : ''}
                    invalidText={getErrorMessage(member.uuid)}
                    invalid={!!errors[member.uuid]}
                  />
                )}
              />
            )}
            {isNumeric(member) && (
              <Controller
                control={control}
                name={member.uuid}
                render={({ field }) => (
                  <NumberInput
                    allowEmpty
                    className={styles.numberInput}
                    disableWheel
                    hideSteppers
                    id={`number-${member.uuid}`}
                    key={member.uuid}
                    label={`${member?.display ? member.display + ' ' : ''}${formatLabRange(member)}`}
                    max={member.hiAbsolute ?? undefined}
                    min={member.lowAbsolute ?? undefined}
                    onChange={(_, { value }) => field.onChange(getNumericResultValue(value, member))}
                    onKeyDown={preventInvalidNumberKey(member)}
                    onPaste={preventInvalidNumberPaste(member)}
                    value={typeof field.value === 'number' ? field.value : ''}
                    invalidText={getErrorMessage(member.uuid)}
                    invalid={!!errors[member.uuid]}
                  />
                )}
              />
            )}
            {isCoded(member) && (
              <Controller
                name={member.uuid}
                control={control}
                render={({ field }) => (
                  <Select
                    {...field}
                    className={styles.textInput}
                    defaultValue={getSavedMemberValue(member.uuid, member.datatype.display) ?? ''}
                    id={`select-${member.uuid}`}
                    key={member.uuid}
                    labelText={`${member?.display ? member.display + ' ' : ''}${formatLabRange(member)}`}
                    value={typeof field.value === 'string' ? field.value : ''}
                    invalidText={getErrorMessage(member.uuid)}
                    invalid={!!errors[member.uuid]}
                  >
                    <SelectItem text={t('chooseAnOption', 'Choose an option')} value="" />

                    {member?.answers?.map((answer) => (
                      <SelectItem key={answer.uuid} text={answer.display} value={answer.uuid}>
                        {answer.display}
                      </SelectItem>
                    ))}
                  </Select>
                )}
              />
            )}
          </React.Fragment>
        ))}
    </>
  );
};

export default ResultFormField;
