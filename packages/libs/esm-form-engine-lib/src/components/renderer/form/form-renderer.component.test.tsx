import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ObsAdapter } from '../../../adapters/obs-adapter';
import { EncounterFormProcessor } from '../../../processors/encounter/encounter-form-processor';
import type { FormContextProps } from '../../../provider/form-provider';
import type { FormField, FormProcessorContextProps, FormSchema } from '../../../types';
import { FieldValidator } from '../../../validators/form-validator';
import NumberField from '../../inputs/number/number.component';
import { FormRenderer } from './form-renderer.component';

const signals = vi.hoisted(() => ({ updates: 0, context: null as FormContextProps | null }));

// Retain native RHF, controls, expressions, observation adaptation and field logic.
vi.mock('@openmrs/esm-framework/src/internal', async () => {
  const stubs = await import('../../../../../../test-utils/stubs/esm-framework.mock');
  const expressions = await import('../../../../../esm-expression-evaluator/src');
  const state = { loaded: true, config: {} };
  return {
    ...stubs,
    ...expressions,
    getConfigStore: () => ({ subscribe: () => () => {}, getState: () => state, getInitialState: () => state }),
  };
});
vi.mock('../../../registry/registry', () => ({
  getRegisteredExpressionHelpers: () => ({}),
  getPreviewFieldControl: () => NumberField,
  getFieldControlWithFallback: async () => NumberField,
}));
vi.mock('../../processor-factory/form-processor-factory.component', () => ({ default: () => null }));
vi.mock('../../../provider/form-factory-provider', () => {
  const factory = {
    registerForm: (_name: string, _subForm: boolean, context: FormContextProps) => {
      // Bound a regression instead of leaving an infinite React update loop running.
      if (++signals.updates > 40) throw new Error('Form updates did not settle');
      signals.context = context;
    },
    setIsFormDirty: vi.fn(),
    workspaceLayout: 'minimized',
    isFormExpanded: true,
  };
  return { useFormFactory: () => factory };
});
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, fallback?: string) => fallback ?? key }),
}));

beforeEach(() => {
  signals.updates = 0;
  signals.context = null;
});

function numberField(id: string, label: string): FormField {
  return {
    id,
    label,
    type: 'obs',
    questionOptions: { rendering: 'number', concept: `concept-${id}` },
    meta: { initialValue: { omrsObject: null, refinedValue: null }, submission: null },
  };
}

function growthFields(): FormField[] {
  const age = numberField('edadMeses', 'Age');
  const head = numberField('perimetroCefalicoCm', 'Head circumference');
  head.required = 'edadMeses < 60';
  head.hide = { hideWhenExpression: 'edadMeses >= 60' };
  const abdomen = numberField('perimetroAbdominalCm', 'Abdominal circumference');
  abdomen.required = 'edadMeses >= 60';
  abdomen.hide = { hideWhenExpression: 'edadMeses < 60' };
  const weight = numberField('pesoKg', 'Weight');
  weight.questionOptions.max = '200';
  const height = numberField('tallaCm', 'Height');
  const bmi = numberField('imc', 'BMI');
  bmi.readonly = true;
  bmi.questionOptions.calculate = {
    calculateExpression:
      'isEmpty(pesoKg) || isEmpty(tallaCm) ? undefined : (pesoKg / ((tallaCm / 100) * (tallaCm / 100)))',
  };
  return [age, head, abdomen, weight, height, bmi];
}

function rendererContext(fields: FormField[]): FormProcessorContextProps {
  const schema = {
    name: 'Synthetic growth',
    pages: [{ label: 'Growth', sections: [{ label: 'Measurements', questions: fields }] }],
  } as FormSchema;
  return {
    isPreview: true,
    formJson: schema,
    formFields: fields,
    formFieldAdapters: { obs: ObsAdapter },
    formFieldValidators: { form_field: FieldValidator },
    sessionMode: 'enter',
    layoutType: 'small-desktop',
    patient: null,
    visit: null,
    sessionDate: new Date('2026-10-10T12:00:00Z'),
    location: null,
    currentProvider: null,
    processor: new EncounterFormProcessor(schema),
  };
}

function mount(context: FormProcessorContextProps, values: Record<string, unknown>) {
  render(
    <FormRenderer
      processorContext={context}
      initialValues={values}
      isSubForm={false}
      setIsLoadingFormDependencies={() => {}}
      onDependencyError={() => {}}
    />,
  );
}

async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  const updates = signals.updates;
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  expect(signals.updates).toBe(updates);
}

it('settles after repeated determinant changes and updates visibility and required labels', async () => {
  const context = rendererContext(growthFields());
  mount(context, { edadMeses: null });
  const age = await screen.findByRole('spinbutton', { name: /Age/i });
  for (const value of [24, 72, 24]) {
    fireEvent.change(age, { target: { value: String(value) } });
    await settle();
    expect(age).toHaveValue(value);
    const visible = value < 60 ? 'Head circumference' : 'Abdominal circumference';
    const hidden = value < 60 ? 'Abdominal circumference' : 'Head circumference';
    expect(screen.getByRole('spinbutton', { name: new RegExp(visible) })).toBeInTheDocument();
    expect(screen.queryByRole('spinbutton', { name: new RegExp(hidden) })).not.toBeInTheDocument();
    const labelId = value < 60 ? 'perimetroCefalicoCm-label' : 'perimetroAbdominalCm-label';
    expect(within(screen.getByTestId(labelId)).getByTitle('Required')).toBeInTheDocument();
    expect(signals.context.methods.getValues('edadMeses')).toBe(value);
  }
});

it('recalculates and adapts BMI after successive weight and height changes', async () => {
  const context = rendererContext(growthFields());
  const values = await new EncounterFormProcessor(context.formJson).getInitialValues(context);
  mount(context, values);
  const weight = await screen.findByRole('spinbutton', { name: /Weight/i });
  fireEvent.change(weight, { target: { value: '20' } });
  fireEvent.change(screen.getByRole('spinbutton', { name: /Height/i }), { target: { value: '100' } });
  await waitFor(() => expect(screen.getByRole('spinbutton', { name: /BMI/i })).toHaveValue(20));
  fireEvent.change(weight, { target: { value: '24' } });
  await waitFor(() => expect(screen.getByRole('spinbutton', { name: /BMI/i })).toHaveValue(24));
  await settle();
  expect(signals.context.formFields.find((field) => field.id === 'imc').meta.submission.newValue).toMatchObject({
    value: 24,
  });
});

it('preserves the observation identity when editing a saved value', async () => {
  const weight = numberField('pesoKg', 'Weight');
  weight.meta.initialValue.omrsObject = { uuid: 'owned-weight-observation', value: 12 } as never;
  const context = rendererContext([weight]);
  context.sessionMode = 'edit';
  mount(context, { pesoKg: 12 });
  const input = await screen.findByRole('spinbutton', { name: /Weight/i });
  expect(input).toHaveValue(12);
  fireEvent.change(input, { target: { value: '13' } });
  await settle();
  expect(weight.meta.submission.newValue).toMatchObject({ uuid: 'owned-weight-observation', value: 13 });
});

it('reuses a historical value through the native handler and updates its dependents', async () => {
  const context = rendererContext(growthFields());
  context.isPreview = false;
  context.previousDomainObjectValue = { uuid: 'owned-previous-encounter' };
  context.processor = {
    getHistoricalValue: async (field: FormField) =>
      field.id === 'edadMeses' ? { value: 72, display: '72' } : { value: null, display: '' },
  } as never;
  mount(context, { edadMeses: null });
  fireEvent.click(await screen.findByRole('button', { name: 'Reuse value' }));
  await settle();
  expect(screen.getByRole('spinbutton', { name: /Age/i })).toHaveValue(72);
  expect(screen.queryByRole('spinbutton', { name: /Head circumference/i })).not.toBeInTheDocument();
  expect(screen.getByRole('spinbutton', { name: /Abdominal circumference/i })).toBeInTheDocument();
  expect(signals.context.methods.getValues('edadMeses')).toBe(72);
});

it('clears a validation error when a numeric input is corrected', async () => {
  const context = rendererContext(growthFields());
  context.formFields.forEach((field) => {
    field.validators = [{ type: 'form_field' }];
  });
  mount(context, { pesoKg: null });
  const weight = await screen.findByRole('spinbutton', { name: /Weight/i });
  fireEvent.change(weight, { target: { value: '210' } });
  expect(weight).toHaveAttribute('aria-invalid', 'true');
  fireEvent.change(weight, { target: { value: '20' } });
  await settle();
  expect(weight).not.toHaveAttribute('aria-invalid', 'true');
  expect(signals.context.getFormField('pesoKg').meta.submission.newValue).toMatchObject({ value: 20 });
});

it('adapts a calculated initial value after native asynchronous initialization', async () => {
  const fields = growthFields();
  fields.find((field) => field.id === 'pesoKg').questionOptions.defaultValue = 20;
  fields.find((field) => field.id === 'tallaCm').questionOptions.defaultValue = 100;
  const context = rendererContext(fields);
  const processor = new EncounterFormProcessor(context.formJson);
  const values = await processor.getInitialValues(context);
  expect(values.imc).toBe(20);
  mount(context, values);
  await screen.findByRole('spinbutton', { name: /BMI/i });
  await settle();
  expect(screen.getByRole('spinbutton', { name: /BMI/i })).toHaveValue(20);
  expect(fields.find((field) => field.id === 'imc').meta.submission.newValue).toMatchObject({ value: 20 });
});
