export const ANTECEDENT_TYPE_SYSTEM = 'http://sihsalus.org/fhir/CodeSystem/antecedent-type';
export const OPENMRS_CONDITION_CATEGORY_SYSTEM = 'http://terminology.hl7.org/CodeSystem/condition-category';
export const OPENMRS_ANTECEDENT_CATEGORY_CODE = 'problem-list-item';
export const OPENMRS_ANTECEDENT_CATEGORY_DISPLAY = 'Problem List Item';

const ANTECEDENT_TYPE_NOTE_PREFIX = '__sihsalus_antecedent_type:';

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
  [key: string]: unknown;
}

export interface FhirConditionCategory {
  coding?: Array<FhirCoding>;
  text?: string;
  [key: string]: unknown;
}

export interface FhirConditionNote {
  authorString?: string;
  text?: string;
  time?: string;
  [key: string]: unknown;
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

/** Patient pathology includes prior diagnoses and untyped history, but excludes explicit family and other types. */
export function isPathologicalAntecedentType(value?: string | null): boolean {
  const type = normalizeAntecedentTypeCode(value);
  return type === undefined || type === 'pathological' || type === 'definitive-diagnosis';
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
          system: OPENMRS_CONDITION_CATEGORY_SYSTEM,
          code: OPENMRS_ANTECEDENT_CATEGORY_CODE,
          display: OPENMRS_ANTECEDENT_CATEGORY_DISPLAY,
        },
      ],
    },
  ];
}

export function buildAntecedentTypeNote(
  code?: string | null,
  noteText?: string | null,
): Array<FhirConditionNote> | undefined {
  const option = getAntecedentTypeOption(code);
  const cleanNoteText = stripAntecedentTypeFromNoteText(noteText);
  const noteParts = [option ? `${ANTECEDENT_TYPE_NOTE_PREFIX}${option.code}` : undefined, cleanNoteText].filter(
    (part): part is string => Boolean(part),
  );

  return noteParts.length ? [{ text: noteParts.join('\n') }] : undefined;
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

export function getAntecedentTypeFromNote(notes?: Array<FhirConditionNote>): AntecedentTypeCode | undefined {
  for (const note of notes ?? []) {
    for (const line of note.text?.split(/\r?\n/) ?? []) {
      if (line.trim().toLowerCase().startsWith(ANTECEDENT_TYPE_NOTE_PREFIX)) {
        const code = normalizeAntecedentTypeCode(line.trim().slice(ANTECEDENT_TYPE_NOTE_PREFIX.length));
        if (code) {
          return code;
        }
      }
    }
  }
  return undefined;
}

export function getAntecedentTypeFromCondition(
  categories?: Array<FhirConditionCategory>,
  notes?: Array<FhirConditionNote>,
): AntecedentTypeCode | undefined {
  return getAntecedentTypeFromNote(notes) ?? getAntecedentTypeFromCategory(categories);
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

export function getConditionNoteText(notes?: Array<FhirConditionNote>): string | undefined {
  return (
    notes
      ?.map((note) => stripAntecedentTypeFromNoteText(note.text))
      .filter(Boolean)
      .join('\n') || undefined
  );
}

/** Preserve annotations and their metadata when changing the SIH Salus marker. */
export function updateAntecedentTypeNotes(
  notes: Array<FhirConditionNote> | undefined,
  code?: AntecedentTypeCode,
  noteText?: string,
): Array<FhirConditionNote> | undefined {
  const existingType = getAntecedentTypeFromNote(notes);
  const type = code ?? existingType;
  const textChanged = noteText !== undefined && noteText.trim() !== (getConditionNoteText(notes) ?? '');
  if (type === existingType && !textChanged) {
    return notes;
  }
  if (textChanged && (notes?.length ?? 0) > 1) {
    // A scalar field cannot safely replace independently authored annotations.
    throw new Error('Multiple clinical annotations cannot be replaced by a single note.');
  }
  const existingNotes = notes?.length ? notes : [{}];
  return existingNotes.map((note, index) => {
    const text = textChanged ? noteText : stripAntecedentTypeFromNoteText(note.text);
    const nextText = index === 0 ? buildAntecedentTypeNote(type, text)?.[0]?.text : text;
    return { ...note, text: nextText ?? '' };
  });
}

function stripAntecedentTypeFromNoteText(noteText?: string | null): string | undefined {
  const visibleText = noteText
    ?.split(/\r?\n/)
    .filter((line) => !line.trim().toLowerCase().startsWith(ANTECEDENT_TYPE_NOTE_PREFIX))
    .join('\n')
    .trim();

  return visibleText || undefined;
}
