import { type OpenmrsResource } from '@openmrs/esm-framework/src/internal';
import { type FormContextProps } from '../provider/form-provider';
import {
  type FormField,
  type FormFieldValueAdapter,
  type FormProcessorContextProps,
  type ValueAndDisplay,
} from '../types';
import { gracefullySetSubmission } from '../utils/common-utils';

type ResourceWithLabel = OpenmrsResource & { name?: string };
type EncounterProviderEntry = {
  provider?: ResourceWithLabel;
};
type EncounterProviderResource = OpenmrsResource & {
  encounterProviders?: EncounterProviderEntry[];
};

export const EncounterProviderAdapter: FormFieldValueAdapter = {
  transformFieldValue: function (field: FormField, value: unknown, _context: FormContextProps): unknown {
    return gracefullySetSubmission(field, typeof value === 'string' ? value : undefined, undefined);
  },
  getInitialValue: function (
    _field: FormField,
    sourceObject: OpenmrsResource,
    context: FormProcessorContextProps,
  ): string | undefined {
    const encounter = sourceObject ?? context.previousDomainObjectValue;
    return getLatestProvider(encounter)?.uuid ?? context.currentProvider?.uuid;
  },
  getPreviousValue: function (
    _field: FormField,
    sourceObject: OpenmrsResource,
    context: FormProcessorContextProps,
  ): ValueAndDisplay {
    const encounter = sourceObject ?? context.previousDomainObjectValue;
    const provider = getLatestProvider(encounter);
    return {
      value: provider?.uuid,
      display: provider?.display ?? provider?.name ?? '',
    };
  },
  getDisplayValue: function (_field: FormField, value: unknown): unknown {
    if (isDisplayableResource(value) && typeof value.display === 'string') {
      return value.display;
    }
    return value;
  },
  tearDown: function (): void {
    return;
  },
};

function getLatestProvider(encounter: OpenmrsResource): ResourceWithLabel | null {
  if (hasEncounterProviders(encounter)) {
    const lastProviderIndex = encounter.encounterProviders.length - 1;
    return encounter.encounterProviders[lastProviderIndex]?.provider ?? null;
  }
  return null;
}

function hasEncounterProviders(encounter: OpenmrsResource): encounter is EncounterProviderResource {
  return (
    Boolean(encounter) &&
    typeof encounter === 'object' &&
    'encounterProviders' in encounter &&
    Array.isArray((encounter as EncounterProviderResource).encounterProviders)
  );
}

function isDisplayableResource(value: unknown): value is ResourceWithLabel {
  return Boolean(value) && typeof value === 'object';
}
