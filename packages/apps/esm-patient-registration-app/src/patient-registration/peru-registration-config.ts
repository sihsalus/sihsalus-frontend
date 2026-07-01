import { type FieldDefinition, type RegistrationConfig, type SectionDefinition } from '../config-schema';

export const peruDniPatientIdentifierTypeUuid = '550e8400-e29b-41d4-a716-446655440001';
export const peruCarnetExtranjeriaPatientIdentifierTypeUuid = '550e8400-e29b-41d4-a716-446655440002';
export const peruPassportPatientIdentifierTypeUuid = '550e8400-e29b-41d4-a716-446655440003';
export const peruDiePatientIdentifierTypeUuid = '8d793bee-c2cc-11de-8d13-0010c6dffd0f';
export const peruInsuranceTypeAttributeTypeUuid = '56188294-b42c-481d-a987-4b495116c580';
export const peruInsuranceCodeAttributeTypeUuid = '374b130f-7457-476f-87b1-f182aa77c434';
export const peruInsuranceAccreditationStatusAttributeTypeUuid = '9b3df0a1-0c58-4f55-9868-9c38f1db1005';
export const peruInsuranceAccreditationCheckedAtAttributeTypeUuid = '9b3df0a1-0c58-4f55-9868-9c38f1db1006';
export const peruInsuranceAccreditationActiveConceptUuid = '9b3df0a1-0c58-4f55-9868-9c38f1db2051';
export const peruInsuranceAccreditationInactiveConceptUuid = '9b3df0a1-0c58-4f55-9868-9c38f1db2052';
export const peruPhoneAttributeTypeUuid = '14d4f066-15f5-102d-96e4-000c29c2a5d7';
export const peruMobilePhoneAttributeTypeUuid = 'fee4e8ef-aef8-4bb9-8ed0-7ded6055c61f';
export const peruEmailAttributeTypeUuid = '4bdf3a33-2f63-11f0-8ab4-1a7535b1b3e8';

const peruDefaultPatientIdentifierTypeUuids = [
  peruDniPatientIdentifierTypeUuid, // DNI
];

export const peruForeignPatientIdentifierTypeUuids = [
  peruCarnetExtranjeriaPatientIdentifierTypeUuid, // Carné de Extranjería
  peruPassportPatientIdentifierTypeUuid, // Pasaporte
  peruDiePatientIdentifierTypeUuid, // Documento de Identidad Extranjero
];

const peruPreRegistrationSections = ['identityLookup'];
const peruSections = ['filiation', 'bloodData', 'insurance', 'responsiblePerson', 'medicalRecord'];
const peruResponsiblePersonSection = 'responsiblePerson';
const peruIdentityLookupFieldOrder = ['id', 'reniecLookup', 'sisLookup'];
const peruDemographicsFieldOrder = ['name', 'dob', 'gender', 'nationality'];
const peruContactFieldOrder = ['address', 'birthAddress', 'phone', 'mobilePhone', 'email'];
const peruLandlinePhoneValidationRegex = '^(?:(?:\\+51)?[1-8][0-9]{7}|0[1-8][0-9]{7})$';
const peruMobilePhoneValidationRegex = '^(?:\\+51)?9[0-9]{8}$';
const peruEmailValidationRegex = '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$';
const peruPhonePlaceholder = '012345678';
const peruMobilePhonePlaceholder = '987654321';
// UUID/direction values must match the relationship types defined in
// sihsalus-content (configuration/backend_configuration/relationshiptypes).
// Keep these in sync when those UUIDs change.
const minorResponsibleRelationshipTypes = [
  'e6be4def-dbc8-462a-8714-53da66903cb8/aIsToB', // Madre
  '8d91a210-c2cc-11de-8d13-0010c6dffd0f/aIsToB', // Padre
  '057de23f-3d9c-4314-9391-4452970739c6/aIsToB', // Apoderado
];
const companionRelationshipType = '3501ac02-0fb0-4ced-8a3e-f578f0ff5276/aIsToB'; // Acompañante

const peruSectionDefinitions: Array<SectionDefinition> = [
  {
    id: 'identityLookup',
    name: 'Validación de identidad y seguro',
    fields: peruIdentityLookupFieldOrder,
  },
  {
    id: 'contact',
    name: 'Residencia, nacimiento y contacto',
    fields: ['address', 'birthAddress', 'phone', 'mobilePhone', 'email'],
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
    label: 'Celular',
    placeholder: peruMobilePhonePlaceholder,
    showHeading: false,
    validation: { required: false, matches: peruMobilePhoneValidationRegex },
  },
  {
    id: 'email',
    type: 'person attribute',
    uuid: peruEmailAttributeTypeUuid,
    label: 'Correo electrónico',
    showHeading: false,
    validation: { required: false, matches: peruEmailValidationRegex },
  },
  {
    id: 'nationality',
    type: 'person attribute',
    uuid: '9b3df0a1-0c58-4f55-9868-9c38f1db1007',
    label: 'Nacionalidad',
    showHeading: false,
    answerConceptSetUuid: '7869ef7a-be6c-4108-9ee5-9cc7470e0b2d',
    searchable: true,
  },
  {
    id: 'civilStatus',
    type: 'person attribute',
    uuid: '8d871f2a-c2cc-11de-8d13-0010c6dffd0f',
    label: 'Estado civil',
    showHeading: false,
    answerConceptSetUuid: 'aa345a81-3811-4e9c-be18-d6be727623e0',
    customConceptAnswers: [
      { uuid: '798d5304-a301-4fb9-9a55-c568ab843c2d', label: 'Soltero(a)' },
      { uuid: 'c40e34a1-47b4-4627-945f-bea67f9017df', label: 'Casado(a)' },
      { uuid: 'bff95b64-d1b5-45ec-b5ad-a736c38a4cc1', label: 'Conviviente' },
      { uuid: 'a10b6eeb-287f-4580-8ba7-9c8ee78a6ffc', label: 'Divorciado(a)' },
      { uuid: 'b8e84a87-3dca-4c0b-a524-ef2b124166d4', label: 'Viudo(a)' },
      { uuid: '62bd5ec8-5ffb-4ddc-97b4-84fde7bab601', label: 'Otros' },
      { uuid: '3a88104a-3f04-4a43-8835-bc976b950527', label: 'No indicado' },
    ],
  },
  {
    id: 'ethnicity',
    type: 'person attribute',
    uuid: '8d871386-c2cc-11de-8d13-0010c6dffd0f',
    label: 'Etnia',
    showHeading: false,
    answerConceptSetUuid: '70482c1e-181e-416d-a0c4-a93919f9f2ef',
    searchable: true,
  },
  {
    id: 'nativeLanguage',
    type: 'person attribute',
    uuid: '8d872150-c2cc-11de-8d13-0010c6dffd0f',
    label: 'Idioma nativo',
    showHeading: false,
    answerConceptSetUuid: 'e103e272-b021-5573-b95b-26121fe8810d',
    searchable: true,
  },
  {
    id: 'occupation',
    type: 'person attribute',
    uuid: '8d871afc-c2cc-11de-8d13-0010c6dffd0f',
    label: 'Ocupación',
    showHeading: false,
    answerConceptSetUuid: 'c6eb629e-35a3-48c1-a9fe-a19cfd81bd72',
    searchable: true,
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
    uuid: peruInsuranceTypeAttributeTypeUuid,
    label: 'Tipo de seguro',
    showHeading: false,
    answerConceptSetUuid: '6b932638-242e-49ef-8ba7-0ae87199835c',
    customConceptAnswers: [
      { uuid: 'b61a9ff9-1485-4388-9f67-9c341f847f85', label: 'SIS Gratuito' },
      { uuid: 'cc6958d9-7948-4f29-b244-4ff896c0b2ee', label: 'SIS Emprendedor' },
      { uuid: 'e43e0a71-0b5d-4fc2-b599-a76e4562ae5a', label: 'SIS Semicontributivo' },
      { uuid: 'b76a9a24-4905-4132-a215-8a567281852a', label: 'Plan de atención SIS' },
      { uuid: 'f38b048f-ee8b-4244-b3eb-a47a34c38f04', label: 'ESSALUD' },
      { uuid: '4e4f62f9-2171-4eef-8d67-1c7edc7735a8', label: 'FOSPOLI' },
      { uuid: 'ec420364-fde1-452d-9c48-fafb4ea73a58', label: 'Seguro privado' },
    ],
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
    customConceptAnswers: [
      { uuid: '9b3df0a1-0c58-4f55-9868-9c38f1db2021', label: 'Rh positivo' },
      { uuid: '9b3df0a1-0c58-4f55-9868-9c38f1db2022', label: 'Rh negativo' },
    ],
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
    readOnlyOnCreate: true,
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
    readOnlyOnCreate: true,
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
    label: 'Fecha de acreditación',
    inputType: 'date',
    allowFutureDates: false,
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

function placeResponsiblePersonAfterDemographics(sections: Array<string>) {
  const responsiblePersonIndex = sections.indexOf(peruResponsiblePersonSection);

  if (responsiblePersonIndex === -1) {
    return sections;
  }

  sections.splice(responsiblePersonIndex, 1);
  const demographicsIndex = sections.indexOf('demographics');
  const insertionIndex = demographicsIndex === -1 ? sections.length : demographicsIndex + 1;
  sections.splice(insertionIndex, 0, peruResponsiblePersonSection);

  return sections;
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

  placeResponsiblePersonAfterDemographics(sections);

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
        placeholder: phoneFieldConfiguration.placeholder || peruPhonePlaceholder,
        validation: {
          required: phoneFieldConfiguration.validation?.required ?? false,
          matches: phoneFieldConfiguration.validation?.matches || peruLandlinePhoneValidationRegex,
        },
      },
    },
    relationshipOptions: {
      ...config.relationshipOptions,
      minorResponsibleRelationshipTypes,
      companionRelationshipType,
    },
    defaultPatientIdentifierTypes,
  };
}
