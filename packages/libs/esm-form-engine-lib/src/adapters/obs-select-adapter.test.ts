import type { FormContextProps } from '../provider/form-provider';
import type { FormField, FormProcessorContextProps } from '../types';
import { assignedObsIds, hasPreviousObsValueChanged, ObsAdapter } from './obs-adapter';

const makeField = (): FormField => ({
  id: 'onset',
  type: 'obs',
  meta: { initialValue: { omrsObject: null, refinedValue: null } },
  questionOptions: {
    rendering: 'select',
    concept: 'text-concept',
    answers: [{ value: 'Gradual', label: 'Inicio gradual' }],
  },
});

beforeEach(() => {
  assignedObsIds.length = 0;
});

it('saves, reloads and displays a Text select without turning its value into a concept', async () => {
  const field = makeField();
  const saved = ObsAdapter.transformFieldValue(field, 'Gradual', {} as FormContextProps);
  expect(saved).toMatchObject({ value: 'Gradual', concept: 'text-concept', formFieldPath: 'rfe-forms-onset' });
  const reloaded = makeField();
  const encounter = {
    uuid: 'synthetic-encounter',
    obs: [{ ...saved, uuid: 'synthetic-obs', concept: { uuid: 'text-concept' } }],
  };
  const value = await ObsAdapter.getInitialValue(reloaded, encounter as never, {} as FormProcessorContextProps);
  expect(value).toBe('Gradual');
  expect(ObsAdapter.getDisplayValue(reloaded, value)).toBe('Inicio gradual');
  expect(hasPreviousObsValueChanged(reloaded, value)).toBe(false);
});

it('preserves a previously recorded free-text value and only writes an explicit replacement', async () => {
  const field = makeField();
  const encounter = {
    uuid: 'synthetic-encounter',
    obs: [
      {
        uuid: 'old-obs',
        concept: { uuid: 'text-concept' },
        value: 'Relato anterior',
        formFieldPath: 'rfe-forms-onset',
      },
    ],
  };
  const value = await ObsAdapter.getInitialValue(field, encounter as never, {} as FormProcessorContextProps);
  expect(ObsAdapter.getDisplayValue(field, value)).toBe('Relato anterior');
  expect(hasPreviousObsValueChanged(field, value)).toBe(false);
  expect(ObsAdapter.transformFieldValue(field, 'Gradual', {} as FormContextProps)).toMatchObject({
    uuid: 'old-obs',
    value: 'Gradual',
  });
});

it('keeps coded answers and empty values unchanged', () => {
  const field = makeField();
  field.questionOptions.answers = [{ concept: 'coded-answer', label: 'Respuesta codificada' }];
  expect(ObsAdapter.getDisplayValue(field, 'coded-answer')).toBe('Respuesta codificada');
  expect(ObsAdapter.getDisplayValue(field, '')).toBe('');
});
