import { type OpenmrsResource } from '@openmrs/esm-framework/src/internal';
import { type FormContextProps } from '../provider/form-provider';
import {
  type FormField,
  type FormFieldValueAdapter,
  type FormProcessorContextProps,
  type ValueAndDisplay,
} from '../types';
import { gracefullySetSubmission } from '../utils/common-utils';

type LocationRef = OpenmrsResource & { name?: string };
type EncounterLocationResource = OpenmrsResource & { location?: LocationRef };

export const EncounterLocationAdapter: FormFieldValueAdapter = {
  transformFieldValue: function (field: FormField, value: unknown, _context: FormContextProps): unknown {
    return gracefullySetSubmission(field, typeof value === 'string' ? value : undefined, undefined);
  },
  getInitialValue: function (
    _field: FormField,
    sourceObject: OpenmrsResource,
    context: FormProcessorContextProps,
  ): string | undefined {
    return getEncounterLocation(sourceObject)?.uuid ?? context.location?.uuid;
  },
  getPreviousValue: function (
    _field: FormField,
    sourceObject: OpenmrsResource,
    context: FormProcessorContextProps,
  ): ValueAndDisplay {
    const encounter = sourceObject ?? context.previousDomainObjectValue;
    const location = encounter ? getEncounterLocation(encounter) : null;
    return {
      value: location?.uuid,
      display: location?.display ?? location?.name ?? '',
    };
  },
  getDisplayValue: function (_field: FormField, value: unknown): unknown {
    return value;
  },
  tearDown: function (): void {
    return;
  },
};

function getEncounterLocation(sourceObject: OpenmrsResource): LocationRef | null {
  if (!sourceObject || typeof sourceObject !== 'object' || !('location' in sourceObject)) {
    return null;
  }

  const location = (sourceObject as EncounterLocationResource).location;
  return location ?? null;
}
