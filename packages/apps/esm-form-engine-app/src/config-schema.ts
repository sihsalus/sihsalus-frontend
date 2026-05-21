import { Type } from '@openmrs/esm-framework';

export const defaultLegacyConceptCompatibilityMap: Record<string, string> = {
  '5219AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA': '71b58cff-879b-4358-98d5-2165434d4324',
  '160531AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA': '162169AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  '159615AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA': 'c4010006-0000-4000-8000-000000000006',
  '1271AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA': '162169AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  '1651AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA': '162169AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  '1282AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA': '162169AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  '1272AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA': '162169AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
};

export const configSchema = {
  hideUnansweredQuestionsInReadonlyForms: {
    _type: Type.Boolean,
    _description:
      'Controls whether empty fields are hidden in embedded readonly forms. When true, empty non-transient fields are hidden when forms are displayed in embedded-view mode.',
    _default: false,
  },
  phq9Concepts: {
    _type: Type.Object,
    _description: 'PHQ-9 concept UUIDs for score calculation',
    _default: {
      notAtAll: '160215AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      severalDays: '167000AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      moreThanHalf: '167001AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      nearlyEveryDay: '167002AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    },
  },
  legacyConceptCompatibilityMap: {
    _type: Type.Object,
    _description:
      'Compatibility remap for legacy O3 form schemas that reference concept UUIDs not present in the active dictionary. Keys are concept UUIDs from the form schema; values are replacement concept UUIDs available in this OpenMRS instance.',
    _default: defaultLegacyConceptCompatibilityMap,
  },
};

export interface ConfigObject {
  hideUnansweredQuestionsInReadonlyForms: boolean;
  phq9Concepts: {
    notAtAll: string;
    severalDays: string;
    moreThanHalf: string;
    nearlyEveryDay: string;
  };
  legacyConceptCompatibilityMap: Record<string, string>;
}
