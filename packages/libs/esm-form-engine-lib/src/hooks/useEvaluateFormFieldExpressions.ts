import { useEffect, useMemo, useState } from 'react';
import { type FormProcessorContextProps } from '../types';
import { type QuestionAnswerOption } from '../types/schema';
import { isTrue } from '../utils/boolean-utils';
import { updateFormSectionReferences } from '../utils/common-utils';
import { evaluateExpression, type FormNode } from '../utils/expression-runner';
import { evaluateConditionalAnswered, evaluateHide, evaluateRequired } from '../utils/form-helper';
import { isEmpty } from '../validators/form-validator';

export const useEvaluateFormFieldExpressions = (
  formValues: Record<string, unknown>,
  factoryContext: FormProcessorContextProps,
): {
  evaluatedFormJson: FormProcessorContextProps['formJson'];
  evaluatedFields: FormProcessorContextProps['formFields'];
  evaluatedPagesVisibility: boolean;
} => {
  const { formFields, patient, sessionMode, visit } = factoryContext;
  const [evaluatedFormJson, setEvaluatedFormJson] = useState(factoryContext.formJson);
  const [evaluatedPagesVisibility, setEvaluatedPagesVisibility] = useState(false);

  const evaluatedFields = useMemo(() => {
    return formFields?.map((field) => {
      const fieldNode: FormNode = { value: field, type: 'field' };
      const runnerContext = {
        patient,
        mode: sessionMode,
        visit,
      };
      // evaluate hide
      if (field.hide?.hideWhenExpression) {
        const isHidden = evaluateExpression(
          field.hide.hideWhenExpression,
          fieldNode,
          formFields,
          formValues,
          runnerContext,
        );
        field.isHidden = Boolean(isHidden);
        if (Array.isArray(field.questions)) {
          field.questions.forEach((question) => {
            question.isHidden = Boolean(isHidden);
          });
        }
      } else {
        field.isHidden = false;
      }
      // evaluate required
      field.isRequired = evaluateRequired(field, formFields, formValues, runnerContext, evaluateExpression);
      // evaluate disabled
      if (typeof field.disabled === 'object' && field.disabled.disableWhenExpression) {
        field.isDisabled =
          evaluateExpression(field.disabled.disableWhenExpression, fieldNode, formFields, formValues, runnerContext) ===
          true;
      } else {
        field.isDisabled = isTrue(field.disabled as string);
      }
      // evaluate conditional answered
      if (field.validators?.some((validator) => validator.type === 'conditionalAnswered')) {
        evaluateConditionalAnswered(field, formFields);
      }
      // evaluate conditional hide for answers
      field.questionOptions.answers
        ?.filter((answer) => !isEmpty(answer.hide?.hideWhenExpression))
        .forEach((answer) => {
          answer.isHidden = Boolean(
            evaluateExpression(answer.hide.hideWhenExpression, fieldNode, formFields, formValues, runnerContext),
          );
        });
      // evaluate conditional disable for answers
      field.questionOptions.answers
        ?.filter((answer: QuestionAnswerOption) => !isEmpty(answer.disable?.disableWhenExpression))
        .forEach((answer: QuestionAnswerOption) => {
          answer.disable.isDisabled = Boolean(
            evaluateExpression(answer.disable?.disableWhenExpression, fieldNode, formFields, formValues, runnerContext),
          );
        });
      // evaluate readonly
      if (typeof field.readonly === 'string' && isNotBooleanString(field.readonly)) {
        field.meta.readonlyExpression = field.readonly;
        field.readonly = Boolean(evaluateExpression(field.readonly, fieldNode, formFields, formValues, runnerContext));
      }
      // evaluate repeat limit
      const limitExpression = field.questionOptions.repeatOptions?.limitExpression;
      if (field.questionOptions.rendering === 'repeating' && !isEmpty(limitExpression)) {
        const limit = evaluateExpression(limitExpression, fieldNode, formFields, formValues, runnerContext);
        field.questionOptions.repeatOptions.limit =
          typeof limit === 'string' || typeof limit === 'number' ? String(limit) : undefined;
      }
      return field;
    });
  }, [formFields, formValues, patient, sessionMode, visit]);

  useEffect(() => {
    factoryContext.formJson?.pages?.forEach((page) => {
      if (page.hide) {
        evaluateHide(
          { value: page, type: 'page' },
          formFields,
          formValues,
          sessionMode,
          patient,
          evaluateExpression,
          null,
        );
      } else {
        page.isHidden = false;
      }
      page?.sections?.forEach((section) => {
        if (section.hide) {
          evaluateHide(
            { value: section, type: 'section' },
            formFields,
            formValues,
            sessionMode,
            patient,
            evaluateExpression,
            null,
          );
        } else {
          section.isHidden = false;
        }
      });
    });
    if (factoryContext.formJson) {
      setEvaluatedFormJson(updateFormSectionReferences(factoryContext.formJson));
    }
    setEvaluatedPagesVisibility(true);
  }, [factoryContext.formJson, formFields, formValues, patient, sessionMode]);

  return { evaluatedFormJson, evaluatedFields, evaluatedPagesVisibility };
};

// helpers

function isNotBooleanString(str: string): boolean {
  return str !== 'true' && str !== 'false';
}
