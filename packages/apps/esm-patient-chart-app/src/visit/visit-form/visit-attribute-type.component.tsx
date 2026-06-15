import {
  Checkbox,
  DatePicker,
  DatePickerInput,
  NumberInput,
  Select,
  SelectItem,
  SelectSkeleton,
  TextArea,
  TextInput,
  TextInputSkeleton,
} from '@carbon/react';
import { useConfig } from '@openmrs/esm-framework';
import { safeEvaluateExpression } from '@openmrs/esm-patient-common-lib';
import {
  shouldPreventPlainNumberKey,
  shouldPreventPlainNumberPaste,
  validatePlainNumberInput,
} from '@openmrs/esm-utils';
import dayjs from 'dayjs';
import React, { useEffect, useId, useMemo } from 'react';
import { Controller, type ControllerRenderProps, useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { type ChartConfig } from '../../config-schema';
import {
  useConceptAnswersForVisitAttributeType,
  useConceptDisplay,
  useVisitAttributeType,
} from '../hooks/useVisitAttributeType';

import styles from './visit-attribute-type.scss';
import { type VisitFormData } from './visit-form.resource';

function preventInvalidFloatKey(event: React.KeyboardEvent<HTMLInputElement>) {
  if (event.ctrlKey || event.metaKey || event.altKey) {
    return;
  }

  if (shouldPreventPlainNumberKey(event.key)) {
    event.preventDefault();
  }
}

function preventInvalidFloatPaste(event: React.ClipboardEvent<HTMLInputElement>) {
  if (shouldPreventPlainNumberPaste(event.clipboardData.getData('text'))) {
    event.preventDefault();
  }
}

interface VisitAttributeTypeFieldsProps {
  setErrorFetchingResources: React.Dispatch<
    React.SetStateAction<{
      blockSavingForm: boolean;
    }>
  >;
}

const VisitAttributeTypeFields: React.FC<VisitAttributeTypeFieldsProps> = ({ setErrorFetchingResources }) => {
  const { defaultVisitAttributesFromPersonAttributes, visitAttributeTypes } = useConfig<ChartConfig>();
  const { control, getValues } = useFormContext<VisitFormData>();
  const readonlyVisitAttributeUuids = useMemo(
    () =>
      new Set(
        (defaultVisitAttributesFromPersonAttributes ?? []).map(({ visitAttributeTypeUuid }) => visitAttributeTypeUuid),
      ),
    [defaultVisitAttributesFromPersonAttributes],
  );

  if (visitAttributeTypes?.length) {
    const { visitAttributes } = getValues();

    return (
      <>
        {visitAttributeTypes.map((attributeType) => {
          const showAttributeType = attributeType?.showWhenExpression
            ? safeEvaluateExpression(attributeType.showWhenExpression, {
                visitAttributes,
              })
            : true;

          return (
            showAttributeType && (
              <Controller
                key={attributeType.uuid}
                name={`visitAttributes.${attributeType.uuid}`}
                control={control}
                render={({ field }) => (
                  <AttributeTypeField
                    key={attributeType.uuid}
                    attributeType={attributeType}
                    readOnly={readonlyVisitAttributeUuids.has(attributeType.uuid)}
                    setErrorFetchingResources={setErrorFetchingResources}
                    fieldProps={field}
                  />
                )}
              />
            )
          );
        })}
      </>
    );
  }

  return null;
};

interface AttributeTypeFieldProps {
  fieldProps: ControllerRenderProps<VisitFormData, `visitAttributes.${string}`>;
  attributeType: {
    uuid: string;
    required: boolean;
  };
  readOnly?: boolean;
  setErrorFetchingResources: React.Dispatch<
    React.SetStateAction<{
      blockSavingForm: boolean;
    }>
  >;
}

const AttributeTypeField: React.FC<AttributeTypeFieldProps> = ({
  attributeType,
  readOnly = false,
  setErrorFetchingResources,
  fieldProps,
}) => {
  const { uuid, required } = attributeType;
  const { data, isLoading, error: errorFetchingVisitAttributeType } = useVisitAttributeType(uuid);
  const {
    answers,
    isLoading: isLoadingAnswers,
    error: errorFetchingVisitAttributeAnswers,
  } = useConceptAnswersForVisitAttributeType(data?.datatypeConfig);
  const isUuidValue = typeof fieldProps.value === 'string' && /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(fieldProps.value);
  const { display: readOnlyConceptDisplay } = useConceptDisplay(
    readOnly && data?.datatypeClassname === 'org.openmrs.customdatatype.datatype.ConceptDatatype' && isUuidValue
      ? fieldProps.value
      : null,
  );
  const { t } = useTranslation();
  const id = useId();
  const labelText = !required && !readOnly ? `${data?.display} (${t('optional', 'optional')})` : data?.display;

  const {
    formState: { errors },
  } = useFormContext<VisitFormData>();

  useEffect(() => {
    if (errorFetchingVisitAttributeType || errorFetchingVisitAttributeAnswers) {
      setErrorFetchingResources((prev) => ({
        blockSavingForm: prev?.blockSavingForm || required,
      }));
    }
  }, [errorFetchingVisitAttributeAnswers, errorFetchingVisitAttributeType, required, setErrorFetchingResources]);

  const fieldToRender = useMemo(() => {
    const { onChange } = fieldProps;

    switch (data?.datatypeClassname) {
      case 'org.openmrs.customdatatype.datatype.ConceptDatatype':
        if (isLoadingAnswers) {
          return <SelectSkeleton />;
        }

        if (errorFetchingVisitAttributeAnswers) {
          return null;
        }

        if (readOnly) {
          const displayValue =
            answers?.find((answer) => answer.uuid === fieldProps.value)?.display ??
            readOnlyConceptDisplay ??
            fieldProps.value ??
            '';

          return (
            <TextInput
              className={styles.readOnlyField}
              id={`readonly-${uuid}`}
              labelText={labelText}
              readOnly
              value={displayValue}
            />
          );
        }

        return (
          <Select
            id={`select-${id}`}
            {...fieldProps}
            labelText={labelText}
            invalid={!!errors.visitAttributes?.[uuid]}
            invalidText={errors.visitAttributes?.[uuid]?.message}
            value={fieldProps.value ?? ''}
            disabled={readOnly}
          >
            <SelectItem text={t('selectAnOption', 'Select an option')} value={''} />
            {(answers ?? []).map((ans) => (
              <SelectItem key={ans.uuid} text={ans.display} value={ans.uuid} />
            ))}
          </Select>
        );
      case 'org.openmrs.customdatatype.datatype.FloatDatatype':
        return (
          <NumberInput
            {...fieldProps}
            value={fieldProps.value ?? ''}
            id={`number-input-${id}`}
            label={labelText}
            hideSteppers
            invalid={!!errors.visitAttributes?.[uuid]}
            invalidText={errors.visitAttributes?.[uuid]?.message}
            disabled={readOnly}
            onChange={(_event, { value }) => {
              const nextValue = value?.toString() ?? '';

              if (nextValue === '') {
                onChange('');
                return;
              }

              const validation = validatePlainNumberInput(nextValue);
              if (!validation.isInvalidFormat) {
                onChange(validation.parsedValue ?? '');
              }
            }}
            onKeyDown={preventInvalidFloatKey}
            onPaste={preventInvalidFloatPaste}
          />
        );
      case 'org.openmrs.customdatatype.datatype.FreeTextDatatype':
        return (
          <TextInput
            {...fieldProps}
            className={readOnly ? styles.readOnlyField : undefined}
            id={uuid}
            labelText={labelText}
            placeholder={labelText}
            invalid={!!errors.visitAttributes?.[uuid]}
            invalidText={errors.visitAttributes?.[uuid]?.message}
            value={fieldProps.value ?? ''}
            readOnly={readOnly}
          />
        );
      case 'org.openmrs.customdatatype.datatype.LongFreeTextDatatype':
        return (
          <TextArea
            {...fieldProps}
            labelText={labelText}
            invalid={!!errors.visitAttributes?.[uuid]}
            invalidText={errors.visitAttributes?.[uuid]?.message}
            value={fieldProps.value ?? ''}
            readOnly={readOnly}
          />
        );
      case 'org.openmrs.customdatatype.datatype.BooleanDatatype':
        return (
          <Checkbox
            {...fieldProps}
            id={`checkbox-${id}`}
            labelText={labelText}
            invalid={!!errors.visitAttributes?.[uuid]}
            invalidText={errors.visitAttributes?.[uuid]?.message}
            disabled={readOnly}
          />
        );
      case 'org.openmrs.customdatatype.datatype.DateDatatype':
        return (
          <DatePicker
            dateFormat="d/m/Y"
            datePickerType="single"
            onChange={([date]) => onChange(dayjs(date).format('YYYY-MM-DD'))}
          >
            <DatePickerInput
              id={`date-picker-${id}`}
              placeholder="dd/mm/yyyy"
              labelText={labelText}
              type="text"
              invalid={!!errors.visitAttributes?.[uuid]}
              invalidText={errors.visitAttributes?.[uuid]?.message}
              disabled={readOnly}
            />
          </DatePicker>
        );
      default:
        return (
          <TextInput
            {...fieldProps}
            className={readOnly ? styles.readOnlyField : undefined}
            id={`text-input-${id}`}
            labelText={labelText}
            invalid={!!errors.visitAttributes?.[uuid]}
            invalidText={errors.visitAttributes?.[uuid]?.message}
            value={fieldProps.value ?? ''}
            readOnly={readOnly}
          />
        );
    }
  }, [
    uuid,
    answers,
    data,
    isLoadingAnswers,
    labelText,
    t,
    errorFetchingVisitAttributeAnswers,
    fieldProps,
    errors.visitAttributes,
    id,
    readOnly,
    readOnlyConceptDisplay,
  ]);

  if (isLoading) {
    return (
      <div className={styles.visitAttributeField}>
        <TextInputSkeleton />
      </div>
    );
  }

  if (errorFetchingVisitAttributeType) {
    return null;
  }

  return <div className={styles.visitAttributeField}>{fieldToRender}</div>;
};

export default VisitAttributeTypeFields;
