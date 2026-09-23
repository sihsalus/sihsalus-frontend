import { type OpenmrsResource } from '@openmrs/esm-framework';
import { type ValueAndDisplay } from '../types';
import { EncounterFormProcessor } from './encounter/encounter-form-processor';
import { type GetCustomHooksResponse } from './form-processor';

/** Uses the canonical schema/default-value logic without clinical reads or submission. */
export class PreviewFormProcessor extends EncounterFormProcessor {
  async loadDependencies(): Promise<Record<string, unknown>> {
    return {};
  }

  getCustomHooks(): GetCustomHooksResponse {
    return { useCustomHooks: null };
  }

  async getHistoricalValue(): Promise<ValueAndDisplay> {
    return { value: null, display: '' };
  }

  async processSubmission(): Promise<OpenmrsResource> {
    throw new Error('Schema preview cannot submit clinical data');
  }
}
