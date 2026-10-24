import { type OpenmrsResource } from '@openmrs/esm-framework/src/internal';
import { type FormContextProps } from '../provider/form-provider';
import {
  type FormField,
  type FormFieldValueAdapter,
  type FormProcessorContextProps,
  type ValueAndDisplay,
} from '../types';
import { getResourceUuid, gracefullySetSubmission, isPlainObject } from '../utils/common-utils';

type ResourceWithLabel = OpenmrsResource & { name?: string };
type EncounterRoleEntry = {
  encounterRole?: ResourceWithLabel;
  provider?: OpenmrsResource | string;
};
type EncounterRoleResource = OpenmrsResource & {
  encounterProviders?: EncounterRoleEntry[];
};

export const EncounterRoleAdapter: FormFieldValueAdapter = {
  transformFieldValue: function (field: FormField, value: unknown, _context: FormContextProps): unknown {
    return gracefullySetSubmission(field, typeof value === 'string' ? value : undefined, undefined);
  },
  getInitialValue: function (
    _field: FormField,
    sourceObject: OpenmrsResource,
    context: FormProcessorContextProps,
  ): string | undefined {
    const encounter = sourceObject ?? context.domainObjectValue;
    if (hasEncounterProviders(encounter)) {
      // Match EncounterProviderAdapter when a provider field exists. Otherwise
      // only reuse the current provider's own role, never another professional's.
      const providerEntry =
        context.sessionMode === 'view' ||
        context.sessionMode === 'embedded-view' ||
        context.formFields?.some((field) => field.type === 'encounterProvider')
          ? encounter.encounterProviders.at(-1)
          : [...encounter.encounterProviders]
              .reverse()
              .find((entry) => getResourceUuid(entry.provider) === context.currentProvider?.uuid);
      return getResourceUuid(providerEntry?.encounterRole);
    }
    return isDefaultEncounterRole(context.customDependencies?.defaultEncounterRole)
      ? context.customDependencies.defaultEncounterRole.uuid
      : undefined;
  },
  getPreviousValue: function (
    _field: FormField,
    sourceObject: OpenmrsResource,
    context: FormProcessorContextProps,
  ): ValueAndDisplay {
    const encounter = sourceObject ?? context.previousDomainObjectValue;
    if (encounter) {
      const role = getLatestEncounterRole(encounter);
      return {
        value: role?.uuid,
        display: role?.display ?? role?.name ?? '',
      };
    }
    return null;
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

function getLatestEncounterRole(encounter: OpenmrsResource): ResourceWithLabel | null {
  if (hasEncounterProviders(encounter)) {
    const lastProviderIndex = encounter.encounterProviders.length - 1;
    return encounter.encounterProviders[lastProviderIndex]?.encounterRole ?? null;
  }
  return null;
}

function hasEncounterProviders(encounter: OpenmrsResource): encounter is EncounterRoleResource {
  return (
    Boolean(encounter) &&
    typeof encounter === 'object' &&
    'encounterProviders' in encounter &&
    Array.isArray((encounter as EncounterRoleResource).encounterProviders)
  );
}

function isDisplayableResource(value: unknown): value is ResourceWithLabel {
  return Boolean(value) && typeof value === 'object';
}

function isDefaultEncounterRole(value: unknown): value is OpenmrsResource {
  return isPlainObject(value) && typeof value.uuid === 'string';
}
