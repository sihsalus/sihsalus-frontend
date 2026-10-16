import { ConceptTrue } from '../constants';
import { prepareEncounter } from '../processors/encounter/encounter-processor-helper';
import type { FormContextProps } from '../provider/form-provider';
import type { FormField, FormProcessorContextProps, OpenmrsEncounter, OpenmrsObs } from '../types';
import { ObsAdapter } from './obs-adapter';

const makeField = (rendering: FormField['questionOptions']['rendering'] = 'text'): FormField => ({
  id: 'synthetic-result',
  type: 'obs',
  meta: { initialValue: { omrsObject: null, refinedValue: null } },
  questionOptions: { rendering, concept: 'synthetic-concept' },
});

const prepare = (field: FormField, encounter: OpenmrsEncounter) =>
  prepareEncounter(
    {
      formJson: { uuid: 'synthetic-form' },
      formFields: [field],
      deletedFields: [],
      domainObjectValue: encounter,
    } as FormContextProps,
    undefined,
    'synthetic-role',
    'synthetic-provider',
    'synthetic-location',
  );

const load = async (field: FormField, originalValue: OpenmrsObs['value']) => {
  const obs: OpenmrsObs = Object.freeze({
    uuid: 'synthetic-original-obs',
    concept: { uuid: 'synthetic-concept' },
    value: originalValue,
    formFieldNamespace: 'rfe-forms',
    formFieldPath: 'rfe-forms-synthetic-result',
  });
  const encounter = { uuid: 'synthetic-encounter', obs: [obs] } satisfies OpenmrsEncounter;
  const initial = await ObsAdapter.getInitialValue(field, encounter, {} as FormProcessorContextProps);
  return { encounter, obs, initial };
};

beforeEach(() => ObsAdapter.tearDown());

it.each([
  { rendering: 'text' as const, original: 'Original text', changed: 'Changed text' },
  { rendering: 'select' as const, original: { uuid: 'synthetic-green' }, changed: 'synthetic-yellow' },
  { rendering: 'number' as const, original: 0, changed: 1 },
  { rendering: 'date' as const, original: '2026-10-10 12:00', changed: new Date(2026, 9, 11, 12, 0) },
  { rendering: 'datetime' as const, original: '2026-10-10 12:00', changed: new Date(2026, 9, 10, 12, 1) },
  { rendering: 'toggle' as const, original: { uuid: ConceptTrue }, changed: false },
])(
  'preserves the original $rendering observation after editing A → B → A',
  async ({ rendering, original, changed }) => {
    const field = makeField(rendering);
    const { encounter, obs, initial } = await load(field, original);

    expect(ObsAdapter.transformFieldValue(field, changed, {} as FormContextProps)).toMatchObject({
      uuid: obs.uuid,
      value: changed,
    });
    const changedEncounter = await prepare(field, encounter);
    expect(changedEncounter.uuid).toBe(encounter.uuid);
    expect(changedEncounter.obs).toHaveLength(1);
    expect(changedEncounter.obs[0]).toMatchObject({ uuid: obs.uuid, value: changed });

    expect(ObsAdapter.transformFieldValue(field, initial, {} as FormContextProps)).toBeNull();
    expect(field.meta.submission).toEqual({ newValue: null, voidedValue: null });
    expect(field.meta.initialValue.omrsObject).toMatchObject({ uuid: obs.uuid });
    const revertedEncounter = await prepare(field, encounter);
    expect(revertedEncounter.uuid).toBe(encounter.uuid);
    expect(revertedEncounter.obs).toEqual([]);
    expect(encounter.obs).toEqual([obs]);
    expect(obs.value).toEqual(original);
  },
);

it('cancels a pending void when an existing observation is restored', async () => {
  const field = makeField();
  const { encounter, obs, initial } = await load(field, 'Original text');

  expect(ObsAdapter.transformFieldValue(field, '', {} as FormContextProps)).toBeNull();
  expect((await prepare(field, encounter)).obs).toEqual([{ uuid: obs.uuid, voided: true }]);

  expect(ObsAdapter.transformFieldValue(field, initial, {} as FormContextProps)).toBeNull();
  expect(field.meta.submission).toEqual({ newValue: null, voidedValue: null });
  expect((await prepare(field, encounter)).obs).toEqual([]);
  expect(encounter.obs).toEqual([obs]);
});

it('retains a new observation draft when a new field changes A → B → A', async () => {
  const field = makeField();
  const encounter = { uuid: 'synthetic-encounter', obs: [] } satisfies OpenmrsEncounter;
  expect(await ObsAdapter.getInitialValue(field, encounter, {} as FormProcessorContextProps)).toBe('');

  for (const value of ['New text', 'Changed text', 'New text']) {
    expect(ObsAdapter.transformFieldValue(field, value, {} as FormContextProps)).toMatchObject({ value });
    const payload = await prepare(field, encounter);
    expect(payload.obs).toHaveLength(1);
    expect(payload.obs[0]).toMatchObject({ value, concept: 'synthetic-concept' });
    expect(payload.obs[0].uuid).toBeUndefined();
  }
  expect(encounter.obs).toEqual([]);
});
