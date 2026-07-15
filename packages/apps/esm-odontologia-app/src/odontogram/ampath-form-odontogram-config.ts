import type { OdontogramConfig } from '../config-schema';

export const defaultAmpathOdontogramFormPersistence: Required<OdontogramConfig>['ampathFormPersistence'] = {
  formUuid: '1d4ca5a3-79d9-3380-8974-e87af3105631',
  baseFormUuid: '1d4ca5a3-79d9-3380-8974-e87af3105631',
  attentionFormUuid: 'a48b004b-526e-32b5-8965-7dc4ffcb52f1',
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
