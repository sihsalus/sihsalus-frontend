import { type FormField, type FormFieldValidator, type ValidationResult } from '../types';
import { type ExpressionContext, evaluateExpression } from '../utils/expression-runner';
import { translateValidationMessage } from './form-validator';

interface ExpressionValidatorConfig {
  failsWhenExpression?: string;
  warnsWhenExpression?: string;
  message: string;
  formFields: FormField[];
  expressionContext: ExpressionContext;
  values: Record<string, unknown>;
}

export const ExpressionValidator: FormFieldValidator = {
  validate: function (field: FormField, value: unknown, config?: unknown): ValidationResult[] {
    const resolvedConfig = config as ExpressionValidatorConfig;
    const INVALID_VALUE_ERR_CODE = 'value.invalid';
    const invalidValueMessage = translateValidationMessage('invalidValue', 'Invalid value');
    const fieldHasWarningsMessage = translateValidationMessage('fieldHasWarnings', 'Field has warnings');
    resolvedConfig.expressionContext.myValue = value;
    return Object.keys(resolvedConfig)
      .filter((key) => key === 'failsWhenExpression' || key === 'warnsWhenExpression')
      .flatMap((key) => {
        const isErrorValidator = key === 'failsWhenExpression';
        return evaluateExpression(
          resolvedConfig[key as keyof ExpressionValidatorConfig] as string | undefined,
          { value: field, type: 'field' },
          resolvedConfig.formFields,
          { ...resolvedConfig.values, [field.id]: value },
          resolvedConfig.expressionContext,
        )
          ? [
              {
                resultType: isErrorValidator ? 'error' : 'warning',
                errCode: isErrorValidator ? INVALID_VALUE_ERR_CODE : undefined,
                message: resolvedConfig.message
                  ? resolvedConfig.message
                  : isErrorValidator
                    ? invalidValueMessage
                    : fieldHasWarningsMessage,
              },
            ]
          : [];
      });
  },
};
