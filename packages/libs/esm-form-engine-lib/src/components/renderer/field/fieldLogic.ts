import { codedTypes } from '../../../constants';
import { type FormContextProps } from '../../../provider/form-provider';
import { type FormField, type FormFieldValidator, type SessionMode, type ValidationResult } from '../../../types';
import {
  hasRendering,
  isPlainObject,
  isStringOrNumber,
  isStringValue,
  isValidationResultArray,
} from '../../../utils/common-utils';
import { reportError } from '../../../utils/error-utils';
import { evaluateAsyncExpression, evaluateExpression } from '../../../utils/expression-runner';
import { evaluateDisabled, evaluateHide, evaluateRequired, findFieldSection } from '../../../utils/form-helper';
import { isEmpty } from '../../../validators/form-validator';

type FormValues = Record<string, unknown>;

export function handleFieldLogic(field: FormField, context: FormContextProps): void {
  const {
    methods: { getValues },
  } = context;
  const values = getSafeFormValues(getValues());

  if (codedTypes.includes(field.questionOptions.rendering)) {
    evaluateFieldAnswerDisabled(field, values, context);
  }

  evaluateFieldDependents(field, values, context);
}

function evaluateFieldAnswerDisabled(field: FormField, values: FormValues, context: FormContextProps): void {
  const { sessionMode, formFields, patient, visit } = context;

  field.questionOptions.answers?.forEach((answer) => {
    const disableExpression = answer.disable?.disableWhenExpression;
    if (disableExpression?.includes('myValue')) {
      answer.disable.isDisabled = Boolean(
        evaluateExpression(disableExpression, { value: field, type: 'field' }, formFields, values, {
          mode: sessionMode,
          patient,
          visit,
        }),
      );
    }
  });
}

function evaluateFieldDependents(field: FormField, values: FormValues, context: FormContextProps): void {
  const {
    sessionMode,
    formFields,
    patient,
    formFieldValidators,
    formJson,
    methods: { setValue },
    updateFormField,
    setForm,
    visit,
  } = context;

  let shouldUpdateForm = false;

  if (field.fieldDependents) {
    field.fieldDependents.forEach((dep) => {
      const dependent = formFields.find((candidate) => candidate.id === dep);
      if (!dependent) {
        return;
      }

      if (dependent.questionOptions.calculate?.calculateExpression) {
        void evaluateAsyncExpression(
          dependent.questionOptions.calculate.calculateExpression,
          { value: dependent, type: 'field' },
          formFields,
          values,
          {
            mode: sessionMode,
            patient,
            visit,
          },
        )
          .then((result) => {
            setValue(dependent.id, result);

            const { errors, warnings } = validateFieldValue(dependent, result, context.formFieldValidators, {
              formFields,
              values,
              expressionContext: { patient, mode: sessionMode },
            });

            if (!dependent.meta.submission) {
              dependent.meta.submission = {};
            }

            dependent.meta.submission.errors = errors;
            dependent.meta.submission.warnings = warnings;

            if (!errors.length) {
              context.formFieldAdapters[dependent.type].transformFieldValue(dependent, result, context);
            }

            updateFormField(dependent);
          })
          .catch((error: unknown) => {
            reportError(toError(error), 'Error evaluating calculate expression');
          });
      }

      if (dependent.hide) {
        const targetSection = findFieldSection(formJson, dependent);
        const isSectionVisible = targetSection?.questions.some((question) => !question.isHidden);

        evaluateHide(
          { value: dependent, type: 'field' },
          formFields,
          values,
          sessionMode,
          patient,
          evaluateExpression,
          updateFormField,
        );

        if (targetSection) {
          targetSection.questions = targetSection.questions.map((question) => {
            if (question.id === dependent.id) {
              return dependent;
            }
            return question;
          });

          const isDependentFieldHidden = dependent.isHidden;
          const sectionHasVisibleFieldAfterEvaluation = [...targetSection.questions, dependent].some(
            (candidate) => !candidate.isHidden,
          );

          if (!isSectionVisible && !isDependentFieldHidden) {
            targetSection.isHidden = false;
            shouldUpdateForm = true;
          } else if (isSectionVisible && !sectionHasVisibleFieldAfterEvaluation) {
            targetSection.isHidden = true;
            shouldUpdateForm = true;
          }
        }
      }

      if (typeof dependent.disabled === 'object' && dependent.disabled.disableWhenExpression) {
        dependent.isDisabled = evaluateDisabled(
          { value: dependent, type: 'field' },
          formFields,
          values,
          sessionMode,
          patient,
          evaluateExpression,
        );
      }

      dependent.isRequired = evaluateRequired(
        dependent,
        formFields,
        values,
        { mode: sessionMode, patient, visit },
        evaluateExpression,
      );

      if (dependent.validators?.some((validator) => validator.type === 'conditionalAnswered')) {
        const fieldValidatorConfig = dependent.validators.find((validator) => validator.type === 'conditionalAnswered');
        const validationResults = formFieldValidators['conditionalAnswered'].validate(
          dependent,
          dependent.meta.submission?.newValue,
          {
            ...fieldValidatorConfig,
            expressionContext: { patient, mode: sessionMode },
            values,
            formFields,
          },
        );

        dependent.meta.submission = {
          ...dependent.meta.submission,
          errors: isValidationResultArray(validationResults) ? validationResults : [],
        };
      }

      dependent.questionOptions.answers
        ?.filter((answer) => !isEmpty(answer.hide?.hideWhenExpression))
        .forEach((answer) => {
          answer.isHidden = Boolean(
            evaluateExpression(
              answer.hide?.hideWhenExpression ?? '',
              { value: dependent, type: 'field' },
              formFields,
              values,
              {
                mode: sessionMode,
                patient,
                visit,
              },
            ),
          );
        });

      dependent.questionOptions.answers
        ?.filter((answer) => !isEmpty(answer.disable?.isDisabled))
        .forEach((answer) => {
          answer.disable.isDisabled = Boolean(
            evaluateExpression(
              answer.disable?.disableWhenExpression ?? '',
              { value: dependent, type: 'field' },
              formFields,
              values,
              {
                mode: sessionMode,
                patient,
                visit,
              },
            ),
          );
        });

      if (!dependent.isHidden && isStringValue(dependent.meta.readonlyExpression)) {
        const readonlyValue: unknown = evaluateExpression(
          dependent.meta.readonlyExpression,
          { value: dependent, type: 'field' },
          formFields,
          values,
          {
            mode: sessionMode,
            patient,
            visit,
          },
        );

        if (typeof readonlyValue === 'boolean' || isStringValue(readonlyValue)) {
          dependent.readonly = readonlyValue;
        }
      }

      if (hasRendering(dependent, 'repeating') && !isEmpty(dependent.questionOptions.repeatOptions?.limitExpression)) {
        const evaluatedLimit: unknown = evaluateExpression(
          dependent.questionOptions.repeatOptions?.limitExpression ?? '',
          { value: dependent, type: 'field' },
          formFields,
          values,
          {
            mode: sessionMode,
            patient,
            visit,
          },
        );

        dependent.questionOptions.repeatOptions.limit = isStringOrNumber(evaluatedLimit)
          ? String(evaluatedLimit)
          : undefined;
      }

      updateFormField(dependent);
    });
  }

  if (field.sectionDependents) {
    field.sectionDependents.forEach((sectionId) => {
      for (const page of formJson.pages) {
        const section = page.sections.find((candidate) => candidate.label === sectionId);
        if (section) {
          evaluateHide(
            { value: section, type: 'section' },
            formFields,
            values,
            sessionMode,
            patient,
            evaluateExpression,
            updateFormField,
          );
          shouldUpdateForm = true;
          break;
        }
      }
    });
  }

  if (field.pageDependents) {
    field.pageDependents.forEach((dep) => {
      const dependent = formJson.pages.find((candidate) => candidate.label === dep);
      if (!dependent) {
        return;
      }

      evaluateHide(
        { value: dependent, type: 'page' },
        formFields,
        values,
        sessionMode,
        patient,
        evaluateExpression,
        updateFormField,
      );
      shouldUpdateForm = true;
    });
  }

  if (shouldUpdateForm) {
    setForm(formJson);
  }
}

export interface ValidatorConfig {
  formFields: FormField[];
  values: FormValues;
  expressionContext: {
    patient: fhir.Patient;
    mode: SessionMode;
  };
}

export function validateFieldValue(
  field: FormField,
  value: unknown,
  validators: Record<string, FormFieldValidator>,
  context: ValidatorConfig,
): { errors: ValidationResult[]; warnings: ValidationResult[] } {
  const errors: ValidationResult[] = [];
  const warnings: ValidationResult[] = [];

  if (field.meta.submission?.unspecified) {
    return { errors: [], warnings: [] };
  }

  try {
    field.validators?.forEach((validatorConfig) => {
      const results = validators[validatorConfig.type]?.validate?.(field, value, {
        ...validatorConfig,
        ...context,
      });

      if (isValidationResultArray(results)) {
        results.forEach((result) => {
          if (result.resultType === 'error') {
            errors.push(result);
          } else if (result.resultType === 'warning') {
            warnings.push(result);
          }
        });
      }
    });
  } catch (error: unknown) {
    console.error(toError(error));
  }

  return { errors, warnings };
}

function getSafeFormValues(values: unknown): FormValues {
  return isPlainObject(values) ? values : {};
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(isStringValue(error) ? error : 'Unknown error');
}
