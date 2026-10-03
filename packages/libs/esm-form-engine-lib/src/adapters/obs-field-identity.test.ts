import type { FormContextProps } from '../provider/form-provider';
import type { FormField, FormProcessorContextProps, OpenmrsObs } from '../types';
import { assignedObsIds, findObsByFormField, ObsAdapter } from './obs-adapter';

const field = (id: string): FormField => ({
  id,
  type: 'obs',
  meta: { initialValue: { omrsObject: null, refinedValue: null } },
  questionOptions: { rendering: 'text', concept: 'shared-text-concept' },
});
const earObs: OpenmrsObs = {
  uuid: 'synthetic-ear-obs',
  concept: { uuid: 'shared-text-concept' },
  value: 'Synthetic ear detail',
  formFieldNamespace: 'rfe-forms',
  formFieldPath: 'rfe-forms-earDetail',
};

beforeEach(() => ObsAdapter.tearDown());

it('never assigns an observation from another identified field, even when its concept is shared', () => {
  expect(findObsByFormField([earObs], [], field('noseDetail'))).toEqual([]);
  expect(findObsByFormField([earObs], [], field('earDetail'))).toEqual([earObs]);
});

it('does not void another field when an empty conditional field shares its concept', async () => {
  const hiddenField = field('fontanelleDetail');
  hiddenField.isHidden = true;
  const actualField = field('earDetail');
  const source = { uuid: 'synthetic-encounter', obs: [earObs] };

  expect(await ObsAdapter.getInitialValue(hiddenField, source, {} as FormProcessorContextProps)).toBe('');
  expect(await ObsAdapter.getInitialValue(actualField, source, {} as FormProcessorContextProps)).toBe(earObs.value);
  expect(ObsAdapter.transformFieldValue(hiddenField, '', {} as FormContextProps)).toBeNull();
  expect(ObsAdapter.transformFieldValue(actualField, 'Corrected ear detail', {} as FormContextProps)).toMatchObject({
    uuid: earObs.uuid,
    value: 'Corrected ear detail',
  });
  expect(assignedObsIds).toEqual([earObs.uuid]);
});

it('retains the historical concept fallback only for observations without field identity', () => {
  const legacyObs = {
    ...earObs,
    uuid: 'synthetic-legacy-obs',
    formFieldPath: undefined,
  };
  expect(findObsByFormField([earObs, legacyObs], [], field('noseDetail'))).toEqual([legacyObs]);
  expect(findObsByFormField([legacyObs], [legacyObs.uuid], field('noseDetail'))).toEqual([]);
});
