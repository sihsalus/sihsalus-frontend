export const ANTECEDENT_TYPE_SYSTEM = 'http://sihsalus.org/fhir/CodeSystem/antecedent-type';

export type AntecedentTypeCode =
  | 'pathological'
  | 'definitive-diagnosis'
  | 'surgical'
  | 'previous-hospitalization'
  | 'family'
  | 'social'
  | 'other';

export interface AntecedentTypeOption {
  code: AntecedentTypeCode;
  translationKey: string;
  defaultLabel: string;
  legacyCodes: Array<string>;
}

export interface FhirCoding {
  code?: string;
  display?: string;
  system?: string;
}

export interface FhirConditionCategory {
  coding?: Array<FhirCoding>;
  text?: string;
}

type Translate = (key: string, defaultValue: string) => string;

export const antecedentTypeOptions: Array<AntecedentTypeOption> = [
  {
    code: 'pathological',
    translationKey: 'antecedentTypePathological',
    defaultLabel: 'Patológico',
    legacyCodes: ['patologicos', 'patologico', 'pathological'],
  },
  {
    code: 'definitive-diagnosis',
    translationKey: 'antecedentTypeDefinitiveDiagnosis',
    defaultLabel: 'Diagnóstico definitivo',
    legacyCodes: ['diagnosticos', 'diagnostico', 'diagnosis', 'definitive-diagnosis'],
  },
  {
    code: 'surgical',
    translationKey: 'antecedentTypeSurgical',
    defaultLabel: 'Quirúrgico',
    legacyCodes: ['quirurgicos', 'quirurgico', 'surgical'],
  },
  {
    code: 'previous-hospitalization',
    translationKey: 'antecedentTypePreviousHospitalization',
    defaultLabel: 'Hospitalización previa',
    legacyCodes: ['hospitalizaciones', 'hospitalizacion', 'previous-hospitalization'],
  },
  {
    code: 'family',
    translationKey: 'antecedentTypeFamily',
    defaultLabel: 'Familiar',
    legacyCodes: ['family', 'familia', 'familiar'],
  },
  {
    code: 'social',
    translationKey: 'antecedentTypeSocial',
    defaultLabel: 'Social',
    legacyCodes: ['social'],
  },
  {
    code: 'other',
    translationKey: 'antecedentTypeOther',
    defaultLabel: 'Otro',
    legacyCodes: ['otros', 'otro', 'other'],
  },
];

const antecedentTypesByCode = new Map(antecedentTypeOptions.map((option) => [option.code, option]));

const antecedentTypeAliases = new Map(
  antecedentTypeOptions.flatMap((option) => [
    [option.code, option.code],
    [option.defaultLabel.toLowerCase(), option.code],
    ...option.legacyCodes.map((legacyCode) => [legacyCode, option.code] as const),
  ]),
);

export function normalizeAntecedentTypeCode(value?: string | null): AntecedentTypeCode | undefined {
  if (!value) {
    return undefined;
  }

  return antecedentTypeAliases.get(value.trim().toLowerCase());
}

export function getAntecedentTypeOption(code?: string | null): AntecedentTypeOption | undefined {
  const normalizedCode = normalizeAntecedentTypeCode(code);
  return normalizedCode ? antecedentTypesByCode.get(normalizedCode) : undefined;
}

export function getAntecedentTypeLabel(code?: string | null, translate?: Translate): string {
  const option = getAntecedentTypeOption(code);
  if (!option) {
    return '--';
  }

  return translate ? translate(option.translationKey, option.defaultLabel) : option.defaultLabel;
}

export function buildAntecedentTypeCategory(code?: string | null): Array<FhirConditionCategory> | undefined {
  const option = getAntecedentTypeOption(code);
  if (!option) {
    return undefined;
  }

  return [
    {
      coding: [
        {
          system: ANTECEDENT_TYPE_SYSTEM,
          code: option.code,
          display: option.defaultLabel,
        },
      ],
      text: option.defaultLabel,
    },
  ];
}

export function getAntecedentTypeFromCategory(
  categories?: Array<FhirConditionCategory>,
): AntecedentTypeCode | undefined {
  if (!categories?.length) {
    return undefined;
  }

  const sihsalusCoding = categories
    .flatMap((category) => category.coding ?? [])
    .find((coding) => coding.system === ANTECEDENT_TYPE_SYSTEM);
  const sihsalusCode = normalizeAntecedentTypeCode(sihsalusCoding?.code);
  if (sihsalusCode) {
    return sihsalusCode;
  }

  const codedMatch = categories
    .flatMap((category) => category.coding ?? [])
    .map((coding) => normalizeAntecedentTypeCode(coding.code) ?? normalizeAntecedentTypeCode(coding.display))
    .find(Boolean);
  if (codedMatch) {
    return codedMatch;
  }

  return categories.map((category) => normalizeAntecedentTypeCode(category.text)).find(Boolean);
}

export function getConditionCategoryDisplay(categories?: Array<FhirConditionCategory>): string {
  if (!categories?.length) {
    return '--';
  }

  const antecedentType = getAntecedentTypeFromCategory(categories);
  if (antecedentType) {
    return getAntecedentTypeLabel(antecedentType);
  }

  const category = categories[0];
  const coding = category?.coding?.[0];
  return category?.text ?? coding?.display ?? coding?.code ?? '--';
}
