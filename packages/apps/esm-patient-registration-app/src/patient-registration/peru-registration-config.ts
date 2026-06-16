import { type FieldDefinition, type RegistrationConfig, type SectionDefinition } from '../config-schema';

export const peruDniPatientIdentifierTypeUuid = '550e8400-e29b-41d4-a716-446655440001';
export const peruCarnetExtranjeriaPatientIdentifierTypeUuid = '550e8400-e29b-41d4-a716-446655440002';
export const peruDiePatientIdentifierTypeUuid = '8d793bee-c2cc-11de-8d13-0010c6dffd0f';
export const peruInsuranceCodeAttributeTypeUuid = '374b130f-7457-476f-87b1-f182aa77c434';
export const peruInsuranceAccreditationStatusAttributeTypeUuid = '9b3df0a1-0c58-4f55-9868-9c38f1db1005';
export const peruInsuranceAccreditationCheckedAtAttributeTypeUuid = '9b3df0a1-0c58-4f55-9868-9c38f1db1006';
export const peruInsuranceAccreditationActiveConceptUuid = '9b3df0a1-0c58-4f55-9868-9c38f1db2051';
export const peruInsuranceAccreditationInactiveConceptUuid = '9b3df0a1-0c58-4f55-9868-9c38f1db2052';
export const peruPhoneAttributeTypeUuid = '14d4f066-15f5-102d-96e4-000c29c2a5d7';
export const peruMobilePhoneAttributeTypeUuid = 'fee4e8ef-aef8-4bb9-8ed0-7ded6055c61f';

const peruDefaultPatientIdentifierTypeUuids = [
  peruDniPatientIdentifierTypeUuid, // DNI
];

export const peruForeignPatientIdentifierTypeUuids = [
  peruCarnetExtranjeriaPatientIdentifierTypeUuid, // Carné de Extranjería
  '550e8400-e29b-41d4-a716-446655440003', // Pasaporte
  peruDiePatientIdentifierTypeUuid, // Documento de Identidad Extranjero
];

const peruPreRegistrationSections = ['identityLookup'];
const peruSections = ['filiation', 'bloodData', 'insurance', 'responsiblePerson', 'medicalRecord'];
const peruIdentityLookupFieldOrder = ['id', 'reniecLookup', 'sisLookup'];
const peruDemographicsFieldOrder = ['name', 'dob', 'gender', 'nationality'];
const peruContactFieldOrder = ['address', 'birthAddress', 'phone', 'mobilePhone'];
const peruPhoneValidationRegex = '^\\+?[0-9][0-9\\s().-]{5,19}$';
const minorResponsibleRelationshipTypes = [
  '8d91a210-c2cc-11de-8d13-0010c6dffdff/aIsToB',
  '8d91a210-c2cc-11de-8d13-0010c6dffd0f/aIsToB',
  '057de23f-3d9c-4314-9391-4452970739c6/aIsToB',
];

const peruSectionDefinitions: Array<SectionDefinition> = [
  {
    id: 'identityLookup',
    name: 'Validación de identidad y seguro',
    fields: peruIdentityLookupFieldOrder,
  },
  {
    id: 'contact',
    name: 'Residencia, nacimiento y contacto',
    fields: ['address', 'birthAddress', 'phone', 'mobilePhone'],
  },
  {
    id: 'filiation',
    name: 'Datos de filiación',
    fields: ['civilStatus', 'ethnicity', 'nativeLanguage', 'occupation', 'educationLevel', 'religion'],
  },
  {
    id: 'bloodData',
    name: 'Grupo sanguíneo y factor Rh',
    fields: ['bloodGroup', 'rhFactor'],
  },
  {
    id: 'insurance',
    name: 'Seguro',
    fields: ['insuranceType', 'insuranceCode', 'insuranceAccreditationStatus', 'insuranceAccreditationCheckedAt'],
  },
  {
    id: 'responsiblePerson',
    name: 'Acompañante o responsable',
    fields: [],
  },
  {
    id: 'medicalRecord',
    name: 'Historia clínica',
    fields: ['medicalRecordStatus', 'medicalRecordArchiveType'],
  },
];

const peruFieldDefinitions: Array<FieldDefinition> = [
  {
    id: 'mobilePhone',
    type: 'person attribute',
    uuid: peruMobilePhoneAttributeTypeUuid,
    label: 'Número de Celular',
    showHeading: false,
    validation: { required: false, matches: peruPhoneValidationRegex },
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
    uuid: peruInsuranceCodeAttributeTypeUuid,
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
    defaultValue: '9b3df0a1-0c58-4f55-9868-9c38f1db2031',
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
    defaultValue: '9b3df0a1-0c58-4f55-9868-9c38f1db2041',
  },
  {
    id: 'insuranceAccreditationStatus',
    type: 'person attribute',
    uuid: peruInsuranceAccreditationStatusAttributeTypeUuid,
    label: 'Estado de acreditación de seguro',
    showHeading: false,
    answerConceptSetUuid: '9b3df0a1-0c58-4f55-9868-9c38f1db2005',
    customConceptAnswers: [
      { uuid: peruInsuranceAccreditationActiveConceptUuid, label: 'Vigente' },
      { uuid: peruInsuranceAccreditationInactiveConceptUuid, label: 'No vigente' },
      { uuid: '9b3df0a1-0c58-4f55-9868-9c38f1db2053', label: 'Pendiente' },
      { uuid: '9b3df0a1-0c58-4f55-9868-9c38f1db2054', label: 'No consultada' },
    ],
    defaultValue: '9b3df0a1-0c58-4f55-9868-9c38f1db2054',
  },
  {
    id: 'insuranceAccreditationCheckedAt',
    type: 'person attribute',
    uuid: peruInsuranceAccreditationCheckedAtAttributeTypeUuid,
    label: 'Fecha/hora de acreditación',
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

function orderPeruDemographicsSection(sectionDefinitions: Array<SectionDefinition>) {
  const demographics = sectionDefinitions.find((section) => section.id === 'demographics');
  if (!demographics) {
    return [
      ...sectionDefinitions,
      {
        id: 'demographics',
        name: 'Basic Info',
        fields: peruDemographicsFieldOrder,
      },
    ];
  }

  return sectionDefinitions.map((section) =>
    section.id === 'demographics'
      ? {
          ...section,
          fields: orderPeruDemographicsFields(section.fields),
        }
      : section,
  );
}

function orderPeruDemographicsFields(fields: Array<string>) {
  const visibleDemographicsFields = [
    ...fields.filter(
      (field) =>
        !peruIdentityLookupFieldOrder.includes(field) &&
        field !== 'minsaLookup' &&
        field !== 'birthplace' &&
        field !== 'birthAddress',
    ),
    'nationality',
  ].filter((field, index, demographicsFields) => demographicsFields.indexOf(field) === index);

  return [
    ...peruDemographicsFieldOrder.filter((field) => visibleDemographicsFields.includes(field)),
    ...visibleDemographicsFields.filter((field) => !peruDemographicsFieldOrder.includes(field)),
  ];
}

function normalizePeruLookupSection(sectionDefinitions: Array<SectionDefinition>) {
  const lookupFields = new Set([...peruIdentityLookupFieldOrder, 'minsaLookup']);

  return sectionDefinitions.map((section) => {
    if (section.id === 'identityLookup') {
      const fields = [
        ...peruIdentityLookupFieldOrder.filter((field) => section.fields.includes(field)),
        ...section.fields
          .map((field) => (field === 'minsaLookup' ? 'reniecLookup' : field))
          .filter((field) => !peruIdentityLookupFieldOrder.includes(field)),
      ].filter((field, index, fields) => fields.indexOf(field) === index);

      return {
        ...section,
        fields,
      };
    }

    return {
      ...section,
      fields: section.fields.filter((field) => !lookupFields.has(field)),
    };
  });
}

function orderPeruContactSection(sectionDefinitions: Array<SectionDefinition>) {
  return sectionDefinitions.map((section) => {
    if (section.id !== 'contact') {
      return section;
    }

    const fields = section.fields.filter((field) => field !== 'birthplace');

    return {
      ...section,
      fields: [
        ...peruContactFieldOrder.filter((field) => fields.includes(field)),
        ...fields.filter((field) => !peruContactFieldOrder.includes(field)),
      ].filter((field, index, fields) => fields.indexOf(field) === index),
    };
  });
}

export function getEffectiveRegistrationConfig(config: RegistrationConfig): RegistrationConfig {
  const sections = config.sections.filter(
    (section) =>
      section !== 'relationships' && section !== 'birthplace' && !peruPreRegistrationSections.includes(section),
  );
  const phoneFieldConfiguration = (config.fieldConfigurations.phone ?? {}) as Partial<
    RegistrationConfig['fieldConfigurations']['phone']
  >;

  peruPreRegistrationSections
    .slice()
    .reverse()
    .forEach((section) => {
      if (!sections.includes(section)) {
        sections.unshift(section);
      }
    });

  let insertionIndex = sections.length;

  peruSections.forEach((section) => {
    if (sections.includes(section)) {
      return;
    }

    sections.splice(insertionIndex, 0, section);
    insertionIndex += 1;
  });

  const defaultPatientIdentifierTypes = [
    ...config.defaultPatientIdentifierTypes,
    ...peruDefaultPatientIdentifierTypeUuids.filter((uuid) => !config.defaultPatientIdentifierTypes.includes(uuid)),
  ];

  return {
    ...config,
    sections,
    sectionDefinitions: orderPeruContactSection(
      orderPeruDemographicsSection(
        normalizePeruLookupSection(mergeSectionDefinitions(config.sectionDefinitions, peruSectionDefinitions)),
      ),
    ),
    fieldDefinitions: appendMissingById(config.fieldDefinitions, peruFieldDefinitions),
    fieldConfigurations: {
      ...config.fieldConfigurations,
      name: {
        ...config.fieldConfigurations.name,
        requireFamilyName2: true,
      },
      phone: {
        ...phoneFieldConfiguration,
        personAttributeUuid: phoneFieldConfiguration.personAttributeUuid || peruPhoneAttributeTypeUuid,
        validation: {
          required: phoneFieldConfiguration.validation?.required ?? false,
          matches: phoneFieldConfiguration.validation?.matches || peruPhoneValidationRegex,
        },
      },
    },
    relationshipOptions: {
      ...config.relationshipOptions,
      minorResponsibleRelationshipTypes,
    },
    defaultPatientIdentifierTypes,
  };
}
