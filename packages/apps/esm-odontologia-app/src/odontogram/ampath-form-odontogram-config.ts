import type { OdontogramConfig } from '../config-schema';

export const defaultAmpathOdontogramFormPersistence: Required<OdontogramConfig>['ampathFormPersistence'] = {
  formUuid: 'c1130000-0000-4000-8000-000000000001',
  baseFormUuid: 'c1130000-0000-4000-8000-000000000001',
  attentionFormUuid: 'c1130000-0000-4000-8000-000000000002',
  concepts: {
    snapshot: 'c1130000-0000-4000-8000-000000000101',
    recordType: 'c1130000-0000-4000-8000-000000000102',
    parentBaseEncounterUuid: 'c1130000-0000-4000-8000-000000000103',
  },
};

export function getAmpathOdontogramFormPersistence(config: OdontogramConfig) {
  return {
    ...defaultAmpathOdontogramFormPersistence,
    ...(config?.ampathFormPersistence ?? {}),
    concepts: {
      ...defaultAmpathOdontogramFormPersistence.concepts,
      ...(config?.ampathFormPersistence?.concepts ?? {}),
    },
  };
}

export function getAmpathOdontogramFormUuid(config: OdontogramConfig, recordType: 'base' | 'attention') {
  const persistence = getAmpathOdontogramFormPersistence(config);

  return recordType === 'base'
    ? (persistence.baseFormUuid ?? persistence.formUuid)
    : (persistence.attentionFormUuid ?? persistence.formUuid);
}
