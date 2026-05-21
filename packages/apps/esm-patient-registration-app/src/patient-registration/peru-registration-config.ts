import { type FieldDefinition, type RegistrationConfig, type SectionDefinition } from '../config-schema';

export const peruDniPatientIdentifierTypeUuid = '550e8400-e29b-41d4-a716-446655440001';
export const peruCarnetExtranjeriaPatientIdentifierTypeUuid = '550e8400-e29b-41d4-a716-446655440002';
export const peruDiePatientIdentifierTypeUuid = '8d793bee-c2cc-11de-8d13-0010c6dffd0f';

const peruDefaultPatientIdentifierTypeUuids = [
  peruDniPatientIdentifierTypeUuid, // DNI
];

export const peruForeignPatientIdentifierTypeUuids = [
  peruCarnetExtranjeriaPatientIdentifierTypeUuid, // Carné de Extranjería
  '550e8400-e29b-41d4-a716-446655440003', // Pasaporte
  peruDiePatientIdentifierTypeUuid, // Documento de Identidad Extranjero
];

const peruSections = ['filiation', 'medicalRecord', 'insurance', 'responsiblePerson'];
const minorResponsibleRelationshipTypes = [
  '8d91a210-c2cc-11de-8d13-0010c6dffdff/aIsToB',
  '8d91a210-c2cc-11de-8d13-0010c6dffd0f/aIsToB',
  '057de23f-3d9c-4314-9391-4452970739c6/aIsToB',
];

const peruSectionDefinitions: Array<SectionDefinition> = [
  {
    id: 'filiation',
    name: 'Datos de filiación',
    fields: [
      'birthplace',
      'civilStatus',
      'ethnicity',
      'nativeLanguage',
      'occupation',
      'educationLevel',
      'religion',
      'bloodGroup',
      'rhFactor',
    ],
  },
  {
    id: 'medicalRecord',
    name: 'Historia clínica',
    fields: ['medicalRecordStatus', 'medicalRecordArchiveType'],
  },
  {
    id: 'insurance',
    name: 'Seguro',
    fields: ['insuranceType', 'insuranceCode', 'insuranceAccreditationStatus', 'insuranceAccreditationCheckedAt'],
  },
  {
    id: 'responsiblePerson',
    name: 'Acompañante o responsable',
    fields: ['companionName', 'companionAge', 'companionRelationship'],
  },
];

const peruFieldDefinitions: Array<FieldDefinition> = [
  {
    id: 'birthplace',
    type: 'person attribute',
    uuid: '8d8718c2-c2cc-11de-8d13-0010c6dffd0f',
    label: 'Lugar de nacimiento',
    showHeading: false,
  },
  {
    id: 'nationality',
    type: 'person attribute',
    uuid: '9b3df0a1-0c58-4f55-9868-9c38f1db1007',
    label: 'Nacionalidad',
    showHeading: false,
  },
  {
    id: 'civilStatus',
    type: 'person attribute',
    uuid: '8d871f2a-c2cc-11de-8d13-0010c6dffd0f',
    label: 'Estado civil',
    showHeading: false,
    answerConceptSetUuid: 'aa345a81-3811-4e9c-be18-d6be727623e0',
  },
  {
    id: 'ethnicity',
    type: 'person attribute',
    uuid: '8d871386-c2cc-11de-8d13-0010c6dffd0f',
    label: 'Etnia',
    showHeading: false,
    answerConceptSetUuid: '70482c1e-181e-416d-a0c4-a93919f9f2ef',
  },
  {
    id: 'nativeLanguage',
    type: 'person attribute',
    uuid: '8d872150-c2cc-11de-8d13-0010c6dffd0f',
    label: 'Idioma nativo',
    showHeading: false,
  },
  {
    id: 'occupation',
    type: 'person attribute',
    uuid: '8d871afc-c2cc-11de-8d13-0010c6dffd0f',
    label: 'Ocupación',
    showHeading: false,
  },
  {
    id: 'educationLevel',
    type: 'person attribute',
    uuid: '8d87236c-c2cc-11de-8d13-0010c6dffd0f',
    label: 'Grado de instrucción',
    showHeading: false,
    answerConceptSetUuid: '2d790984-f088-4d68-984d-efab9db8c889',
  },
  {
    id: 'religion',
    type: 'person attribute',
    uuid: '77bbb234-2312-4644-99d0-fa894d438817',
    label: 'Religión',
    showHeading: false,
    answerConceptSetUuid: '6de6d87e-5af8-41d9-98d2-b660fabf25d9',
  },
  {
    id: 'insuranceType',
    type: 'person attribute',
    uuid: '56188294-b42c-481d-a987-4b495116c580',
    label: 'Tipo de seguro',
    showHeading: false,
    answerConceptSetUuid: '6b932638-242e-49ef-8ba7-0ae87199835c',
  },
  {
    id: 'insuranceCode',
    type: 'person attribute',
    uuid: '374b130f-7457-476f-87b1-f182aa77c434',
    label: 'Código de seguro',
    showHeading: false,
  },
  {
    id: 'bloodGroup',
    type: 'person attribute',
    uuid: '9b3df0a1-0c58-4f55-9868-9c38f1db1001',
    label: 'Grupo sanguíneo',
    showHeading: false,
    answerConceptSetUuid: '9b3df0a1-0c58-4f55-9868-9c38f1db2001',
    customConceptAnswers: [
      { uuid: '8afda27f-8a57-4e45-94dd-297c62a0e1dc', label: 'A' },
      { uuid: 'ac4abc9d-aea9-4676-ba93-125ffd682c41', label: 'B' },
      { uuid: 'ba95eb27-f23e-4587-8a3d-8437e953d374', label: 'AB' },
      { uuid: 'fe9c1d29-077d-4923-acc9-f49798b86b76', label: 'O' },
    ],
  },
  {
    id: 'rhFactor',
    type: 'person attribute',
    uuid: '9b3df0a1-0c58-4f55-9868-9c38f1db1002',
    label: 'Factor Rh',
    showHeading: false,
    answerConceptSetUuid: '54b52ca9-8168-4f63-b2a3-a18899bf0baa',
  },
  {
    id: 'medicalRecordStatus',
    type: 'person attribute',
    uuid: '9b3df0a1-0c58-4f55-9868-9c38f1db1003',
    label: 'Estado de historia clínica',
    showHeading: false,
    answerConceptSetUuid: '9b3df0a1-0c58-4f55-9868-9c38f1db2003',
    customConceptAnswers: [
      { uuid: '9b3df0a1-0c58-4f55-9868-9c38f1db2031', label: 'Activa' },
      { uuid: '9b3df0a1-0c58-4f55-9868-9c38f1db2032', label: 'Pasiva' },
      { uuid: '9b3df0a1-0c58-4f55-9868-9c38f1db2033', label: 'Eliminada' },
    ],
  },
  {
    id: 'medicalRecordArchiveType',
    type: 'person attribute',
    uuid: '9b3df0a1-0c58-4f55-9868-9c38f1db1004',
    label: 'Tipo de archivo de historia clínica',
    showHeading: false,
    answerConceptSetUuid: '9b3df0a1-0c58-4f55-9868-9c38f1db2004',
    customConceptAnswers: [
      { uuid: '9b3df0a1-0c58-4f55-9868-9c38f1db2041', label: 'Archivo común' },
      { uuid: '9b3df0a1-0c58-4f55-9868-9c38f1db2042', label: 'Archivo especial' },
    ],
  },
  {
    id: 'insuranceAccreditationStatus',
    type: 'person attribute',
    uuid: '9b3df0a1-0c58-4f55-9868-9c38f1db1005',
    label: 'Estado de acreditación de seguro',
    showHeading: false,
    answerConceptSetUuid: '9b3df0a1-0c58-4f55-9868-9c38f1db2005',
    customConceptAnswers: [
      { uuid: '9b3df0a1-0c58-4f55-9868-9c38f1db2051', label: 'Vigente' },
      { uuid: '9b3df0a1-0c58-4f55-9868-9c38f1db2052', label: 'No vigente' },
      { uuid: '9b3df0a1-0c58-4f55-9868-9c38f1db2053', label: 'Pendiente' },
      { uuid: '9b3df0a1-0c58-4f55-9868-9c38f1db2054', label: 'No consultada' },
    ],
  },
  {
    id: 'insuranceAccreditationCheckedAt',
    type: 'person attribute',
    uuid: '9b3df0a1-0c58-4f55-9868-9c38f1db1006',
    label: 'Fecha/hora de acreditación',
    showHeading: false,
  },
  {
    id: 'companionName',
    type: 'person attribute',
    uuid: '4697d0e6-5b24-416b-aee6-708cd9a3a1db',
    label: 'Nombre del acompañante o responsable',
    showHeading: false,
  },
  {
    id: 'companionAge',
    type: 'person attribute',
    uuid: '70ce4571-2e2e-44da-a39f-9dae2a658606',
    label: 'Edad del acompañante o responsable',
    showHeading: false,
  },
  {
    id: 'companionRelationship',
    type: 'person attribute',
    uuid: 'a180fa5f-c44e-4490-a981-d7196b70c6ac',
    label: 'Parentesco del acompañante o responsable',
    showHeading: false,
  },
];

function appendMissingById<T extends { id: string }>(configured: Array<T>, defaults: Array<T>) {
  const configuredIds = new Set(configured.map((item) => item.id));
  return [...configured, ...defaults.filter((item) => !configuredIds.has(item.id))];
}

function mergeSectionDefinitions(configured: Array<SectionDefinition>, defaults: Array<SectionDefinition>) {
  const defaultsById = new Map(defaults.map((section) => [section.id, section]));

  return appendMissingById(
    configured.map((section) => {
      const defaultSection = defaultsById.get(section.id);
      if (!defaultSection) {
        return section;
      }

      return {
        ...defaultSection,
        ...section,
        fields: [...section.fields, ...defaultSection.fields.filter((field) => !section.fields.includes(field))],
      };
    }),
    defaults,
  );
}

function insertAfter(fields: Array<string>, target: string, field: string) {
  if (fields.includes(field)) {
    return fields;
  }

  const targetIndex = fields.indexOf(target);
  if (targetIndex < 0) {
    return [...fields, field];
  }

  return [...fields.slice(0, targetIndex + 1), field, ...fields.slice(targetIndex + 1)];
}

function addNationalityToDemographics(sectionDefinitions: Array<SectionDefinition>) {
  const demographics = sectionDefinitions.find((section) => section.id === 'demographics');
  if (!demographics) {
    return [
      ...sectionDefinitions,
      {
        id: 'demographics',
        name: 'Basic Info',
        fields: ['name', 'gender', 'dob', 'id', 'nationality'],
      },
    ];
  }

  return sectionDefinitions.map((section) =>
    section.id === 'demographics'
      ? {
          ...section,
          fields: insertAfter(section.fields, 'id', 'nationality'),
        }
      : section,
  );
}

export function getEffectiveRegistrationConfig(config: RegistrationConfig): RegistrationConfig {
  const sections = [...config.sections];

  peruSections.forEach((section) => {
    if (sections.includes(section)) {
      return;
    }
    const relationshipsIndex = sections.indexOf('relationships');
    if (relationshipsIndex >= 0) {
      sections.splice(relationshipsIndex, 0, section);
    } else {
      sections.push(section);
    }
  });

  const defaultPatientIdentifierTypes = [
    ...config.defaultPatientIdentifierTypes,
    ...peruDefaultPatientIdentifierTypeUuids.filter((uuid) => !config.defaultPatientIdentifierTypes.includes(uuid)),
  ];

  return {
    ...config,
    sections,
    sectionDefinitions: addNationalityToDemographics(
      mergeSectionDefinitions(config.sectionDefinitions, peruSectionDefinitions),
    ),
    fieldDefinitions: appendMissingById(config.fieldDefinitions, peruFieldDefinitions),
    fieldConfigurations: {
      ...config.fieldConfigurations,
      name: {
        ...config.fieldConfigurations.name,
        requireFamilyName2: true,
      },
    },
    relationshipOptions: {
      ...config.relationshipOptions,
      minorResponsibleRelationshipTypes,
    },
    defaultPatientIdentifierTypes,
  };
}
