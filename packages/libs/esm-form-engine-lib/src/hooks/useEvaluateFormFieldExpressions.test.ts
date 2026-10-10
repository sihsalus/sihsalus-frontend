import { renderHook } from '@testing-library/react';
import { handleFieldLogic } from '../components/renderer/field/fieldLogic';
import type { FormContextProps } from '../provider/form-provider';
import type { FormField, FormProcessorContextProps } from '../types';
import { FieldValidator } from '../validators/form-validator';
import { useEvaluateFormFieldExpressions } from './useEvaluateFormFieldExpressions';

// Keep the evaluator real: this library's framework stubs do not export it.
vi.mock('@openmrs/esm-framework/src/internal', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  ...(await import('../../../esm-expression-evaluator/src')),
}));
vi.mock('../registry/registry', () => ({ getRegisteredExpressionHelpers: () => ({}) }));

function field(id: string, required?: FormField['required']): FormField {
  return { id, type: 'obs', required, questionOptions: { rendering: 'number' }, meta: {} };
}

function context(fields: FormField[]): FormProcessorContextProps {
  return {
    formFields: fields,
    sessionMode: 'enter',
    formJson: { pages: [{ label: 'Growth', sections: [{ label: 'Measurements', questions: fields }] }] },
  } as FormProcessorContextProps;
}

it('evaluates CRED015 required expressions alongside visibility at 24 and 72 months', () => {
  const fields = [
    field('edadMeses'),
    field('perimetroCefalicoCm', 'edadMeses < 60'),
    field('perimetroAbdominalCm', 'edadMeses >= 60'),
  ];
  fields[1].hide = { hideWhenExpression: 'edadMeses >= 60' };
  fields[2].hide = { hideWhenExpression: 'edadMeses < 60' };
  const factoryContext = context(fields);
  const { result, rerender } = renderHook(({ values }) => useEvaluateFormFieldExpressions(values, factoryContext), {
    initialProps: { values: { edadMeses: 24 } },
  });
  expect(result.current.evaluatedFields[1]).toMatchObject({ isRequired: true, isHidden: false });
  expect(result.current.evaluatedFields[2]).toMatchObject({ isRequired: false, isHidden: true });
  rerender({ values: { edadMeses: 72 } });
  expect(result.current.evaluatedFields[1]).toMatchObject({ isRequired: false, isHidden: true });
  expect(result.current.evaluatedFields[2]).toMatchObject({ isRequired: true, isHidden: false });
});

it('registers required-only dependencies and revalidates when the determinant changes both ways', () => {
  const fields = [
    field('edadMeses'),
    field('perimetroCefalicoCm', 'edadMeses < 60'),
    field('perimetroAbdominalCm', 'edadMeses >= 60'),
  ];
  const factoryContext = context(fields);
  const values = { edadMeses: 24 };
  renderHook(() => useEvaluateFormFieldExpressions(values, factoryContext));
  expect(fields[0].fieldDependents).toEqual(new Set(['perimetroCefalicoCm', 'perimetroAbdominalCm']));
  const liveContext = {
    ...factoryContext,
    methods: { getValues: () => values },
    updateFormField: vi.fn(),
  } as unknown as FormContextProps;
  for (const age of [72, 24, 72]) {
    values.edadMeses = age;
    handleFieldLogic(fields[0], liveContext);
    expect(fields[1].isRequired).toBe(age < 60);
    expect(fields[2].isRequired).toBe(age >= 60);
    expect(FieldValidator.validate(fields[1], null).length).toBe(age < 60 ? 1 : 0);
    expect(FieldValidator.validate(fields[2], null).length).toBe(age >= 60 ? 1 : 0);
  }
});

it('preserves boolean tokens, absent required, and legacy conditionalRequired rules', () => {
  const fields = [
    field('yes', true),
    field('no', false),
    field('yesToken', 'true'),
    field('noToken', 'false'),
    field('optional'),
    field('choice'),
    field('legacy', {
      type: 'conditionalRequired',
      referenceQuestionId: 'choice',
      referenceQuestionAnswers: ['yes'],
    }),
  ];
  const factoryContext = context(fields);
  const values = { choice: 'yes' };
  const { result } = renderHook(() => useEvaluateFormFieldExpressions(values, factoryContext));
  expect(result.current.evaluatedFields.map((field) => field.isRequired)).toEqual([
    true,
    false,
    true,
    false,
    false,
    false,
    true,
  ]);
  values.choice = 'no';
  handleFieldLogic(fields[5], {
    ...factoryContext,
    methods: { getValues: () => values },
    updateFormField: vi.fn(),
  } as unknown as FormContextProps);
  expect(fields[6].isRequired).toBe(false);
});

it('does not treat a failed or non-boolean expression as a required condition', () => {
  const error = vi.spyOn(console, 'error').mockImplementation(() => {});
  try {
    const fields = [field('failed', 'missingHelper()'), field('text', "'false'"), field('number', '1')];
    const factoryContext = context(fields);
    const values = {};
    const { result } = renderHook(() => useEvaluateFormFieldExpressions(values, factoryContext));
    expect(result.current.evaluatedFields.every((field) => field.isRequired === false)).toBe(true);
    expect(error).toHaveBeenCalled();
  } finally {
    error.mockRestore();
  }
});

it('surfaces a malformed required expression instead of silently marking a field optional', () => {
  const error = vi.spyOn(console, 'error').mockImplementation(() => {});
  try {
    const factoryContext = context([field('invalid', 'edadMeses <')]);
    const values = { edadMeses: 24 };
    expect(() => renderHook(() => useEvaluateFormFieldExpressions(values, factoryContext))).toThrow();
  } finally {
    error.mockRestore();
  }
});
