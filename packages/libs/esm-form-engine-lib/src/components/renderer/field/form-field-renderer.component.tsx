import { ToastNotification } from '@carbon/react';
import { getConfigStore } from '@openmrs/esm-framework/src/internal';
import React, { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { Controller, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useFormProviderContext } from '../../../provider/form-provider';
import { getFieldControlWithFallback, getPreviewFieldControl, getRegisteredControl } from '../../../registry/registry';
import {
  type FormField,
  type FormFieldInputComponent,
  type FormFieldInputProps,
  type FormFieldValue,
  type FormFieldValueAdapter,
  type RenderType,
  type ValidationResult,
  type ValueAndDisplay,
} from '../../../types';
import { isTrue } from '../../../utils/boolean-utils';
import { hasRendering, isPlainObject, isValidationResultArray } from '../../../utils/common-utils';
import { isEmpty } from '../../../validators/form-validator';
import UnspecifiedField from '../../inputs/unspecified/unspecified.component';
import PreviousValueReview from '../../previous-value-review/previous-value-review.component';
import { handleFieldLogic, validateFieldValue } from './fieldLogic';
import { shouldRenderField } from './fieldRenderUtils';
import styles from './form-field-renderer.scss';

export interface FormFieldRendererProps {
  fieldId: string;
  valueAdapter: FormFieldValueAdapter;
  repeatOptions?: {
    targetRendering: RenderType;
  };
}

interface ExternalFormEngineConfig {
  hideUnansweredQuestionsInReadonlyForms?: boolean;
}

type FormValues = Record<string, unknown>;

export const FormFieldRenderer = ({
  fieldId,
  valueAdapter,
  repeatOptions,
}: FormFieldRendererProps): React.JSX.Element | null => {
  const [inputComponentWrapper, setInputComponentWrapper] = useState<{
    value: FormFieldInputComponent;
  } | null>(null);
  const [errors, setErrors] = useState<ValidationResult[]>([]);
  const [warnings, setWarnings] = useState<ValidationResult[]>([]);
  const [historicalValue, setHistoricalValue] = useState<ValueAndDisplay | null>(null);
  const context = useFormProviderContext();
  const formEngineConfigStore = useMemo(() => getConfigStore('@openmrs/esm-form-engine-app'), []);
  const formEngineConfigState = useSyncExternalStore(
    formEngineConfigStore.subscribe,
    formEngineConfigStore.getState,
    formEngineConfigStore.getInitialState,
  );
  const hideUnansweredQuestionsInReadonlyForms =
    (formEngineConfigState.loaded &&
      (formEngineConfigState.config as ExternalFormEngineConfig | null)?.hideUnansweredQuestionsInReadonlyForms) ??
    false;

  const {
    methods: { control, getValues, getFieldState },
    patient,
    sessionMode,
    formFields,
    formFieldValidators,
    addInvalidField,
    removeInvalidField,
    updateFormField,
  } = context;

  const fieldValue: unknown = useWatch({ control, name: fieldId, exact: true });
  const noop = (): void => {};

  const field = useMemo(() => formFields.find((candidate) => candidate.id === fieldId), [fieldId, formFields]);

  const getSafeValues = useCallback((): FormValues => {
    const values: unknown = getValues();
    return isPlainObject(values) ? values : {};
  }, [getValues]);

  const onAfterChange = useCallback(
    (value: unknown): void => {
      if (!field) {
        return;
      }

      const { errors: validationErrors, warnings: validationWarnings } = validateFieldValue(
        field,
        value,
        formFieldValidators,
        {
          formFields,
          values: getSafeValues(),
          expressionContext: { patient, mode: sessionMode },
        },
      );

      if (field.meta.submission) {
        field.meta.submission.errors = undefined;
        field.meta.submission.warnings = undefined;
      }

      if (errors.length && !validationErrors.length) {
        removeInvalidField(field.id);
        setErrors([]);
      } else if (validationErrors.length) {
        setErrors(validationErrors);
        addInvalidField(field);
      }

      if (!validationErrors.length) {
        valueAdapter.transformFieldValue(field, value, context);
      }

      setWarnings(validationWarnings);
      handleFieldLogic(field, context);

      if (field.meta.groupId) {
        const group = formFields.find((candidate) => candidate.id === field.meta.groupId);
        if (group) {
          group.questions = group.questions.map((child) => {
            if (child.id === field.id) {
              return field;
            }
            return child;
          });
          updateFormField(group);
        }
      }
    },
    [
      addInvalidField,
      context,
      errors.length,
      field,
      formFieldValidators,
      formFields,
      getSafeValues,
      patient,
      removeInvalidField,
      sessionMode,
      updateFormField,
      valueAdapter,
    ],
  );

  useEffect(() => {
    if (!field) {
      return;
    }

    let disposed = false;

    const loadInputComponent = async (): Promise<void> => {
      const component = context.isPreview
        ? getPreviewFieldControl(field, repeatOptions?.targetRendering)
        : hasRendering(field, 'repeating') && repeatOptions?.targetRendering
          ? await getRegisteredControl(repeatOptions.targetRendering)
          : await getFieldControlWithFallback(field);

      if (!disposed && component) {
        setInputComponentWrapper({ value: component });
      }
    };

    void loadInputComponent();

    const loadHistoricalValue = async (): Promise<void> => {
      if (
        !context.isPreview &&
        sessionMode === 'enter' &&
        (field.historicalExpression || context.previousDomainObjectValue)
      ) {
        try {
          const value = await context.processor.getHistoricalValue(field, context);
          if (!disposed) {
            setHistoricalValue(value);
          }
        } catch (error: unknown) {
          console.error(toError(error));
        }
      }
    };

    void loadHistoricalValue();

    return (): void => {
      disposed = true;
    };
  }, [context, field, repeatOptions?.targetRendering, sessionMode]);

  useEffect(() => {
    if (!field) {
      return;
    }

    const { isDirty, isTouched } = getFieldState(field.id);
    const { submission, unspecified } = field.meta;
    const { calculate, defaultValue } = field.questionOptions;

    if (
      !isEmpty(fieldValue) &&
      !submission?.newValue &&
      !isDirty &&
      !unspecified &&
      (calculate?.calculateExpression || defaultValue)
    ) {
      valueAdapter.transformFieldValue(field, fieldValue, context);
    }

    if (isDirty || isTouched) {
      onAfterChange(fieldValue);
    }
  }, [context, field, fieldValue, getFieldState, onAfterChange, valueAdapter]);

  useEffect(() => {
    if (!field) {
      return;
    }

    if (isValidationResultArray(field.meta.submission?.errors)) {
      setErrors(field.meta.submission.errors);
    }

    if (isValidationResultArray(field.meta.submission?.warnings)) {
      setWarnings(field.meta.submission.warnings);
    }

    if (field.meta.submission?.unspecified) {
      setErrors([]);
      setWarnings([]);
      removeInvalidField(field.id);
    }
  }, [field, removeInvalidField]);

  if (!field || !inputComponentWrapper) {
    return null;
  }

  const InputComponent = inputComponentWrapper.value as React.ComponentType<FormFieldInputProps>;

  if (!repeatOptions?.targetRendering && isGroupField(field.questionOptions.rendering)) {
    return (
      <InputComponent
        key={field.id}
        field={field}
        value={null}
        errors={errors}
        warnings={warnings}
        setFieldValue={noop}
      />
    );
  }

  if (
    !shouldRenderField(
      sessionMode,
      !!field.questionOptions.isTransient,
      isEmpty(fieldValue),
      hideUnansweredQuestionsInReadonlyForms,
    )
  ) {
    return null;
  }

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback} onReset={noop}>
      <Controller
        control={control}
        name={field.id}
        render={({ field: { value, onChange, onBlur } }) => {
          const controlledValue: unknown = value;
          const previousValue: unknown = historicalValue?.value;
          const handleControlledChange = (nextValue: FormFieldValue): void => {
            onChange(nextValue);
            onAfterChange(nextValue);
            onBlur();
          };

          return (
            <div>
              <InputComponent
                key={`${field.id}-input-component`}
                field={field}
                value={controlledValue as FormFieldValue}
                errors={errors}
                warnings={warnings}
                setFieldValue={handleControlledChange}
              />
              {isUnspecifiedSupported(field) && (
                <div className={styles.unspecifiedContainer}>
                  {field.unspecified && (
                    <UnspecifiedField
                      key={`${field.id}-unspecified`}
                      field={field}
                      setFieldValue={(nextValue) => onChange(nextValue)}
                      onAfterChange={onAfterChange}
                      fieldValue={controlledValue as FormFieldValue}
                    />
                  )}
                </div>
              )}
              {historicalValue?.value && (
                <div>
                  <PreviousValueReview
                    key={`${field.id}-previous-value-review`}
                    previousValue={previousValue as FormFieldValue | undefined}
                    displayText={historicalValue.display}
                    onAfterChange={onAfterChange}
                    field={field}
                  />
                </div>
              )}
            </div>
          );
        }}
      />
    </ErrorBoundary>
  );
};

export function ErrorFallback(_props: { error?: unknown }): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <ToastNotification
      aria-label={t('closesNotification', 'Closes notification')}
      caption=""
      hideCloseButton
      lowContrast
      onClose={function noRefCheck() {}}
      onCloseButtonClick={function noRefCheck() {}}
      statusIconDescription={t('notification', 'Notification')}
      subtitle={t(
        'errorRenderingFieldDescription',
        'This field could not be displayed. Check the form configuration or contact support.',
      )}
      title={t('errorRenderingField', 'Error rendering field')}
    />
  );
}

export function isUnspecifiedSupported(question: FormField): boolean {
  const { rendering } = question.questionOptions;
  return (
    isTrue(question.unspecified) &&
    rendering !== 'toggle' &&
    rendering !== 'group' &&
    rendering !== 'repeating' &&
    rendering !== 'markdown' &&
    rendering !== 'extension-widget' &&
    rendering !== 'workspace-launcher'
  );
}

export function isGroupField(rendering: RenderType): boolean {
  return rendering === 'group' || rendering === 'repeating';
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error('Unknown error');
}
