import { openmrsFetch } from '@openmrs/esm-framework';
import { type FormSchema } from '../types';
import { PreviewFormProcessor } from './preview-form-processor';

const schema: FormSchema = {
  name: 'Synthetic preview',
  uuid: 'synthetic-preview',
  pages: [],
  referencedForms: [],
  processor: 'EncounterFormProcessor',
};

it('has no clinical dependency or history hooks and cannot submit even when called directly', async () => {
  const processor = new PreviewFormProcessor(schema);
  expect(await processor.loadDependencies()).toEqual({});
  expect(processor.getCustomHooks().useCustomHooks).toBeNull();
  expect(await processor.getHistoricalValue()).toEqual({ value: null, display: '' });
  await expect(processor.processSubmission()).rejects.toThrow('Schema preview cannot submit clinical data');
  expect(openmrsFetch).not.toHaveBeenCalled();
});
