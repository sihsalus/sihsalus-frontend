import { type ProviderSchedulingCategoryValidationMode } from '../config-schema';
import { type AppointmentService, type Provider } from '../types';

export type ProviderSchedulingCategoryAssessmentReason =
  | 'validation-off'
  | 'service-without-category'
  | 'provider-not-selected'
  | 'configuration-missing'
  | 'matched'
  | 'category-not-enabled';

export interface ProviderSchedulingCategoryAssessment {
  categoryUuid?: string;
  reason: ProviderSchedulingCategoryAssessmentReason;
  shouldBlock: boolean;
  shouldWarn: boolean;
}

interface AssessProviderSchedulingCategoryOptions {
  mode: ProviderSchedulingCategoryValidationMode;
  providerAttributeTypeUuid?: string;
  provider?: Provider;
  service?: AppointmentService;
}

function getSchedulingCategoryUuid(service?: AppointmentService) {
  const category = service?.speciality;
  return category && 'uuid' in category && typeof category.uuid === 'string' && category.uuid.trim()
    ? category.uuid
    : undefined;
}

export function assessProviderSchedulingCategory({
  mode,
  providerAttributeTypeUuid,
  provider,
  service,
}: AssessProviderSchedulingCategoryOptions): ProviderSchedulingCategoryAssessment {
  if (mode === 'off') {
    return { reason: 'validation-off', shouldBlock: false, shouldWarn: false };
  }

  const categoryUuid = getSchedulingCategoryUuid(service);
  if (!categoryUuid) {
    return {
      reason: 'service-without-category',
      shouldBlock: false,
      shouldWarn: false,
    };
  }
  if (!provider) {
    return {
      categoryUuid,
      reason: 'provider-not-selected',
      shouldBlock: false,
      shouldWarn: false,
    };
  }
  if (!providerAttributeTypeUuid?.trim()) {
    return {
      categoryUuid,
      reason: 'configuration-missing',
      shouldBlock: mode === 'strict',
      shouldWarn: mode === 'warn',
    };
  }

  const enabledCategoryUuids = new Set(
    (provider.attributes ?? [])
      .filter(
        (attribute) =>
          !attribute.voided &&
          attribute.attributeType?.uuid === providerAttributeTypeUuid &&
          typeof attribute.value === 'string',
      )
      .map((attribute) => (attribute.value as string).trim())
      .filter(Boolean),
  );

  if (enabledCategoryUuids.has(categoryUuid)) {
    return {
      categoryUuid,
      reason: 'matched',
      shouldBlock: false,
      shouldWarn: false,
    };
  }

  return {
    categoryUuid,
    reason: 'category-not-enabled',
    shouldBlock: mode === 'strict',
    shouldWarn: mode === 'warn',
  };
}
