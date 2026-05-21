import { Type } from '@openmrs/esm-framework';
import { ANAMNESIS_DEFAULT_CONCEPT_UUIDS } from '@sihsalus/esm-sihsalus-shared';

// ===============================
// MAIN CONFIGURATION SCHEMA
// ===============================

export const configSchema = {
  conditionPageSize: {
    _type: Type.Number,
    _description: 'The default page size for the conditions',
    _default: 5,
  },
  conditionConceptClassUuid: {
    _type: Type.ConceptUuid,
    _description: 'Concept class UUID for condition concepts',
    _default: '8d4918b0-c2cc-11de-8d13-0010c6dffd0f',
  },
  // CONCEPT SETS FOR CONDITIONS
  conditionConceptSets: {
    _type: Type.Object,
    _description: 'ConceptSets for different condition categories',
    _default: {
      antecedentesPatologicos: {
        uuid: 'c33ef45d-aa69-4d9a-9214-1dbb52609601',
        title: 'Antecedentes Patológicos del Menor',
        description: 'ConceptSet para antecedentes patológicos en menores',
      },
    },
  },
  // Fallback concept for free-text antecedents
  conditionFreeTextFallbackConceptUuid: {
    _type: Type.ConceptUuid,
    _description:
      'Concept UUID used when saving free-text antecedents (Otros). This should be a generic "Antecedente" concept.',
    _default: '162169AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  },
  // 1. ENCOUNTER TYPES
  encounterTypes: {
    _type: Type.Object,
    _description: 'List of encounter type UUIDs',
    _default: {
      // Core Encounters (encountertypes.csv)
      externalConsultation: '186c1e78-a99f-4cd0-86de-b8c4ee27a2b5', // Consulta Externa — NTS 029
      specializedConsultation: 'e137c4de-8dbe-4d32-9a76-35f7d1b17f45', // Consulta Especializada — NTS 040
      triage: '67a71486-1a54-468f-ac3e-7091a9a79584', // Triaje — NTS 021
      emergencyCare: '1b70fe57-92c1-4e35-87f7-13d0e04ff12f', // Atención en Emergencia — NTS 021

      // Hospitalization
      hospitalization: '8993b43c-7878-4e80-9257-1da45e84a904', // Hospitalización — NTS 032
      hospitalDischarge: '23bcca89-6dad-4a50-bed2-0ca224a9603f', // Alta Hospitalaria — NTS 032
      bedAssignment: '4c9dc097-a49a-464c-839a-612cc54943dc', // Asignación de Cama — NTS 032
      intraHospitalTransfer: 'c1c5747b-b705-4390-a9ee-27ba7c4b0794', // Traslado Intra-Hospitalario — NTS 032
      hospitalizationProgressNote: '3942f612-fea0-4414-b7a6-eaf24413e145', // Nota de Evolución Hospitalización — RM 546-2011

      // Specialized Care
      dentalCare: '1a58800e-dc0d-49b3-abfa-5da144e08d00', // Atención de Odontología — NTS 040
      mentalHealthEvaluation: '1b9f21c5-928c-4077-bc95-dcd4b1a5a366', // Evaluación de Salud Mental — RM 856-2019
      malnutritionAnemiaCare: '91b5f447-e6f6-4ad0-8ec5-75151b46bd82', // Atención Desnutrición y Anemia — NTS 102
      chronicDiseaseFollowup: '3a542b3a-79a8-4c97-a65b-d6ccc84171a7', // Seguimiento Enf. Crónicas — NTS 067
      hivTestingServices: '5cbb797f-bed5-4301-a3ce-6cc7eb7c687b', // Tamizaje de VIH — NTS 169
      tbTreatmentSupervision: 'a4133bfb-a43a-42ac-84a5-0367451e4f23', // Supervisión DOT TB — NTS 090
      covid19Management: '2314baf3-2876-4ff7-b7f2-a73e157eec57', // Manejo COVID-19 — NTS 094-2022

      // Medical Services
      medicationPrescriptionDispensation: '79488027-0292-4807-afe4-9c037052be40', // Prescripción y Dispensación — NTS 042
      labResults: '328f6f79-4a85-4ff8-9fb8-6b2c839c7649', // Resultados de Laboratorio — NTS 090
      electiveAmbulatorySurgery: 'a0a7d43a-1fd1-4df9-9429-a3e84f1d7c62', // Cirugía Ambulatoria Electiva — NTS 172

      // Administrative
      consultation: 'e4834799-7f43-4552-a6f3-2656880ca52f', // Interconsulta — NTS 102
      referralCounterReferral: '16bec8b6-4a2d-4cf9-8e66-9bb6e1c5d1da', // Referencia y Contrarreferencia — NTS 102
      transferRequest: '07d73526-c3c4-490e-9b0a-1cd884cc3822', // Solicitud de Traslado — NTS 102
      encounterCancellation: '46ee60b6-8212-4464-a592-d7371e8b3a48', // Anulación de Encuentro — RM 546-2011
      healthEducationCounseling: '54e3e45d-b7d7-4259-b64a-334e17b98c40', // Educación y Consejería — NTS 050
      clinicalFileUpload: '319dcd44-19c5-432c-9733-d1f3798fffd6', // Carga de Archivos Clínicos — RM 546-2011
      order: '39da3525-afe4-45ff-8977-c53b7b359158', // Órdenes Médicas
    },
  },

  // 2. FORMS CONFIGURATION
  formsList: {
    _type: Type.Object,
    _description: 'List of form UUIDs',
    _default: {
      // Clinical Forms
      nursingAssessment: '(Página 11 y 12) Valoración de Enfermería',
      medicalOrders: '(Página 13) Órdenes Médicas',
      medicalProgressNote: '(Página 14) Nota de Evolución Médica',
      epicrisis: '(Página 16) Epicrisis',
      clinicalEncounterFormUuid: 'e958f902-64df-4819-afd4-7fb061f59308',

      // HIV/HTS Forms
      defaulterTracingFormUuid: 'a1a62d1e-2def-11e9-b210-d663bd873d93',
      htsScreening: '04295648-7606-11e8-adc0-fa7ae01bbebc',
      htsInitialTest: '402dc5d7-46da-42d4-b2be-f43ea4ad87b0',
      htsRetest: 'b08471f6-0892-4bf7-ab2b-bf79797b8ea4',

      // Consulta Externa Forms
      consultaExternaForm: 'e375206e-186b-3357-9cbf-fdae409f7949',
      anamnesisForm: 'e375206e-186b-3357-9cbf-fdae409f7949',
      soapNoteForm: 'e375206e-186b-3357-9cbf-fdae409f7949',
      referralForm: 'a7379846-a7f9-3fc9-9c8f-f95973fd4c88',

      // Hospital Forms
      medicalProgress: 'HOSP-004-EVOLUCIÓN MÉDICA',
      nursingNotes: 'HOSP-009-NOTAS DE ENFERMERÍA',
      therapeuticSheet: 'HOSP-008-HOJA TERAPÉUTICA',
      vitalSignsControl: 'HOSP-001-CONTROL DE FUNCIONES VITALES',
    },
  },

  // 3. CASE MANAGEMENT
  caseManagementForms: {
    _type: Type.Array,
    _description: 'List of form and encounter UUIDs',
    _default: [
      {
        id: 'high-iit-intervention',
        title: 'High IIT Intervention Form',
        formUuid: '6817d322-f938-4f38-8ccf-caa6fa7a499f',
        encounterTypeUuid: '91b5f447-e6f6-4ad0-8ec5-75151b46bd82', // Atención Desnutrición y Anemia
      },
      {
        id: 'home-visit-checklist',
        title: 'Home Visit Checklist Form',
        formUuid: 'ac3152de-1728-4786-828a-7fb4db0fc384',
        encounterTypeUuid: 'bfbb5dc2-d3e6-41ea-ad86-101336e3e38f', // Atención Extramural
      },
    ],
  },

  // 4. SPECIAL CLINICS
  specialClinics: {
    _type: Type.Array,
    _description: 'List of special clinics',
    _default: [
      {
        id: 'psicologia-clinic',
        title: 'Psicología',
        formUuid: '32e43fc9-6de3-48e3-aafe-3b92f167753d',
        encounterTypeUuid: '1b9f21c5-928c-4077-bc95-dcd4b1a5a366', // Evaluación de Salud Mental
      },
      {
        id: 'physiotherapy-clinic',
        title: 'Terapia Física',
        formUuid: 'fdada8da-75fe-44c6-93e1-782d41e5565b',
        encounterTypeUuid: '465a92f2-baf8-42e9-9612-53064be868e8',
      },
    ],
  },

  // 5. VITALS CONFIGURATION
  vitals: {
    useFormEngine: {
      _type: Type.Boolean,
      _default: false,
      _description:
        'Whether to use an Ampath form as the vitals and biometrics form. If set to true, encounterUuid and formUuid must be set as well.',
    },
    encounterTypeUuid: {
      _type: Type.UUID,
      _default: '67a71486-1a54-468f-ac3e-7091a9a79584', // Triaje (vitales se registran en triaje)
    },
    formUuid: {
      _type: Type.UUID,
      _default: '630ce515-ce70-3635-b8e4-5cc27510bdaa',
    },
    formName: {
      _type: Type.String,
      _default: 'Vitals',
    },
    useMuacColors: {
      _type: Type.Boolean,
      _default: false,
      _description: 'Whether to show/use MUAC color codes. If set to true, the input will show status colors.',
    },
    showPrintButton: {
      _type: Type.Boolean,
      _default: false,
      _description: 'Determines whether or not to display the Print button in the vitals datatable header.',
    },
    logo: {
      src: {
        _type: Type.String,
        _default: null,
        _description: 'A path or URL to an image. Defaults to the OpenMRS SVG sprite.',
      },
      alt: {
        _type: Type.String,
        _default: 'Logo',
        _description: 'Alt text, shown on hover',
      },
      name: {
        _type: Type.String,
        _default: null,
        _description: 'The organization name displayed when image is absent',
      },
    },
  },

  // 6. BIOMETRICS CONFIGURATION
  biometrics: {
    bmiUnit: {
      _type: Type.String,
      _default: 'kg / m²',
    },
  },

  // 7. CONCEPTS CONFIGURATION
  concepts: {
    // Problem and Death Concepts
    probableCauseOfDeathConceptUuid: {
      _type: Type.ConceptUuid,
      _description:
        'Probable cause of death for a given patient determined from interviewing a family member or other non-medical personnel',
      _default: '1599AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    },
    problemListConceptUuid: {
      _type: Type.ConceptUuid,
      _description: 'List of given problems for a given patient',
      _default: '1284AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    },

    // Vital Signs
    systolicBloodPressureUuid: {
      _type: Type.ConceptUuid,
      _default: '5085AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    },
    temperatureUuid: {
      _type: Type.ConceptUuid,
      _default: '5088AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    },
    oxygenSaturationUuid: {
      _type: Type.ConceptUuid,
      _default: '5092AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    },
    weightUuid: {
      _type: Type.ConceptUuid,
      _default: '5089AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    },
    diastolicBloodPressureUuid: {
      _type: Type.ConceptUuid,
      _default: '5086AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    },
    pulseUuid: {
      _type: Type.ConceptUuid,
      _default: '5087AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    },
    respiratoryRateUuid: {
      _type: Type.ConceptUuid,
      _default: '5242AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    },

    // Anthropometric Measurements
    heightUuid: {
      _type: Type.ConceptUuid,
      _description: 'Height or length measurement of the patient',
      _default: '5090AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    },

    // Chief Complaint (CE-3)
    chiefComplaintUuid: {
      _type: Type.ConceptUuid,
      _description: 'Chief complaint / reason for visit (CIEL 5219)',
      _default: '5219AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    },

    // Anamnesis (CE-3.1) — NTS 139 / NTS 229
    anamnesisUuid: {
      _type: Type.ConceptUuid,
      _description: 'Anamnesis / current illness narrative',
      _default: ANAMNESIS_DEFAULT_CONCEPT_UUIDS.anamnesisUuid,
    },
    illnessDurationUuid: {
      _type: Type.ConceptUuid,
      _description: 'Tiempo de enfermedad',
      _default: ANAMNESIS_DEFAULT_CONCEPT_UUIDS.illnessDurationUuid,
    },
    onsetTypeUuid: {
      _type: Type.ConceptUuid,
      _description: 'Forma de inicio',
      _default: ANAMNESIS_DEFAULT_CONCEPT_UUIDS.onsetTypeUuid,
    },
    courseUuid: {
      _type: Type.ConceptUuid,
      _description: 'Curso de la enfermedad actual',
      _default: ANAMNESIS_DEFAULT_CONCEPT_UUIDS.courseUuid,
    },
    appetiteUuid: {
      _type: Type.ConceptUuid,
      _description: 'Función biológica: apetito',
      _default: ANAMNESIS_DEFAULT_CONCEPT_UUIDS.appetiteUuid,
    },
    thirstUuid: {
      _type: Type.ConceptUuid,
      _description: 'Función biológica: sed',
      _default: ANAMNESIS_DEFAULT_CONCEPT_UUIDS.thirstUuid,
    },
    sleepUuid: {
      _type: Type.ConceptUuid,
      _description: 'Función biológica: sueño',
      _default: ANAMNESIS_DEFAULT_CONCEPT_UUIDS.sleepUuid,
    },
    moodUuid: {
      _type: Type.ConceptUuid,
      _description: 'Función biológica: estado de ánimo',
      _default: ANAMNESIS_DEFAULT_CONCEPT_UUIDS.moodUuid,
    },
    urineUuid: {
      _type: Type.ConceptUuid,
      _description: 'Función biológica: orina',
      _default: ANAMNESIS_DEFAULT_CONCEPT_UUIDS.urineUuid,
    },
    bowelMovementsUuid: {
      _type: Type.ConceptUuid,
      _description: 'Función biológica: deposiciones',
      _default: ANAMNESIS_DEFAULT_CONCEPT_UUIDS.bowelMovementsUuid,
    },

    // SOAP Notes (CE-5)
    soapSubjectiveUuid: {
      _type: Type.ConceptUuid,
      _description: 'SOAP Subjective concept (CIEL 160531)',
      _default: '160531AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    },
    soapObjectiveUuid: {
      _type: Type.ConceptUuid,
      _description: 'SOAP Objective concept (CIEL 160532)',
      _default: '160532AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    },
    soapAssessmentUuid: {
      _type: Type.ConceptUuid,
      _description: 'SOAP Assessment concept (CIEL 160533)',
      _default: '160533AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    },
    soapPlanUuid: {
      _type: Type.ConceptUuid,
      _description: 'SOAP Plan concept (CIEL 159615)',
      _default: '159615AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    },

    // Insurance Provider (CE-6)
    insuranceProviderUuid: {
      _type: Type.ConceptUuid,
      _description: 'Insurance/payer type concept (SIS, EsSalud, Privado, Particular)',
      _default: '161631AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    },

    // Diagnosis Occurrence (CE-2)
    diagnosisOccurrenceUuid: {
      _type: Type.ConceptUuid,
      _description: 'Diagnosis occurrence: New vs Repeat',
      _default: '159946AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    },
    diagnosisTypeConceptUuid: {
      _type: Type.ConceptUuid,
      _description: 'Tipo de diagnóstico según NTS-139: presuntivo, definitivo o repetitivo',
      _default: '2d53d39f-c93f-4128-8f7c-1bb45b498497',
    },
    definitiveDiagnosisTypeUuid: {
      _type: Type.ConceptUuid,
      _description: 'Respuesta de tipo de diagnóstico definitivo según NTS-139',
      _default: '2c60a8f6-1787-41be-8434-30ebeb5656ff',
    },
    repeatDiagnosisTypeUuid: {
      _type: Type.ConceptUuid,
      _description: 'Respuesta de tipo de diagnóstico repetitivo según NTS-139',
      _default: '6f653861-8469-4dfa-a0b5-2804f1cfc527',
    },

    // Treatment Plan (CE-4)
    labOrdersUuid: {
      _type: Type.ConceptUuid,
      _description: 'Lab orders / auxiliary exams concept',
      _default: '1271AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    },
    proceduresUuid: {
      _type: Type.ConceptUuid,
      _description: 'Procedures performed concept (CPMS)',
      _default: '1651AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    },
    prescriptionsUuid: {
      _type: Type.ConceptUuid,
      _description: 'Prescriptions / medication orders concept',
      _default: '1282AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    },
    therapeuticIndicationsUuid: {
      _type: Type.ConceptUuid,
      _description: 'Therapeutic indications free-text concept',
      _default: '162169AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    },
    referralUuid: {
      _type: Type.ConceptUuid,
      _description: 'Referral / interconsultation concept',
      _default: '1272AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    },
    nextAppointmentUuid: {
      _type: Type.ConceptUuid,
      _description: 'Next appointment date concept',
      _default: '5096AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    },

    // Admission / hospitalization details
    admissionDateUuid: {
      _type: Type.ConceptUuid,
      _description: 'Admission date concept',
      _default: '1640AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    },
    priorityOfAdmissionUuid: {
      _type: Type.ConceptUuid,
      _description: 'Priority of admission concept',
      _default: '1655AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    },
    admissionWardUuid: {
      _type: Type.ConceptUuid,
      _description: 'Admission ward concept',
      _default: '5fc29316-0869-4b3b-ae2f-cc37c6014eb7',
    },

    // Social history
    alcoholUseUuid: {
      _type: Type.ConceptUuid,
      _description: 'Alcohol use concept',
      _default: '159449AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    },
    alcoholUseDurationUuid: {
      _type: Type.ConceptUuid,
      _description: 'Alcohol use duration concept',
      _default: '1546AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    },
    smokingUuid: {
      _type: Type.ConceptUuid,
      _description: 'Smoking concept',
      _default: '163201AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    },
    smokingDurationUuid: {
      _type: Type.ConceptUuid,
      _description: 'Smoking duration concept',
      _default: '159931AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    },
    otherSubstanceAbuseUuid: {
      _type: Type.ConceptUuid,
      _description: 'Other substance abuse concept',
      _default: '163731AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    },

    // Medical history
    surgicalHistoryUuid: {
      _type: Type.ConceptUuid,
      _description: 'Surgical history concept',
      _default: '30fe6669-75f3-4a1d-89c3-753a060d559a',
    },
    accidentTraumaUuid: {
      _type: Type.ConceptUuid,
      _description: 'Accident or trauma history concept',
      _default: '159520AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    },
    bloodTransfusionUuid: {
      _type: Type.ConceptUuid,
      _description: 'Blood transfusion history concept',
      _default: '161927AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    },
    chronicDiseaseUuid: {
      _type: Type.ConceptUuid,
      _description: 'Chronic disease history concept',
      _default: '1284AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    },
    trueConceptUuid: {
      _type: Type.ConceptUuid,
      _description: 'Boolean true concept',
      _default: 'cf82933b-3f3f-45e7-a5ab-5d31aaee3da3',
    },

    // Ethnic Identity (CE-7)
    ethnicIdentityUuid: {
      _type: Type.ConceptUuid,
      _description: 'Ethnic self-identification concept for HIS reporting (Pertenencia Étnica)',
      _default: '160581AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    },

    // Referencia y Contrarreferencia (CE-8) — NTS 102
    referralTypeUuid: {
      _type: Type.ConceptUuid,
      _description: 'Tipo de referencia: Emergencia, Urgencia, Electiva (f0000170)',
      _default: 'f0000170-0000-4000-8000-000000000170',
    },
    referralReasonUuid: {
      _type: Type.ConceptUuid,
      _description: 'Motivo de referencia (CIEL 160481 — Referral reason)',
      _default: '160481AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    },
    referralDestinationUuid: {
      _type: Type.ConceptUuid,
      _description: 'Establecimiento destino de la referencia (proyecto: establecimiento-destino-referencia)',
      _default: '6a1e18c1-8874-45fe-92dd-26758d5d6ba7',
    },
    counterReferralResponseUuid: {
      _type: Type.ConceptUuid,
      _description: 'Respuesta de contrarreferencia del establecimiento destino (f0000174)',
      _default: 'f0000174-0000-4000-8000-000000000174',
    },
  },

  // 11. RELATIONSHIPS CONFIGURATION
  familyRelationshipsTypeList: {
    _type: Type.Array,
    _description: 'Lista de relaciones familiares (used to list contacts)',
    _default: [
      { uuid: '8d91a210-c2cc-11de-8d13-0010c6dffdff', display: 'Madre' },
      { uuid: '8d91a210-c2cc-11de-8d13-0010c6dffd0f', display: 'Padre' },
      { uuid: '8d91a01c-c2cc-11de-8d13-0010c6dffd0f', display: 'Hermano' },
      { uuid: '5c2f978d-3b7d-493c-9e8f-cb3d1c0b6a55', display: 'Abuelo' },
      { uuid: '8d91a3dc-c2cc-11de-8d13-0010c6dffd0f', display: 'Tío' },
      { uuid: '8d91a3dc-c2cc-11de-8d13-0010c6dffd00', display: 'Sobrino' },
    ],
  },

  pnsRelationships: {
    _type: Type.Array,
    _description: 'List of Partner relationships (PNS - Partner Notification Service)',
    _default: [
      { uuid: '6b1c5e8f-32f7-41b3-bc2a-8b3e97a6d937', display: 'Esposo', sexual: true },
      { uuid: '1e3f4a5b-6789-4cde-9101-abcdef123457', display: 'Pareja', sexual: true },
      { uuid: 'a2b5c9f8-0d2a-4bdf-8d9b-6f3b2d1e5a2f', display: 'Otro' }, //change for otro tipo de contacto sexual
    ],
  },

  otherRelationships: {
    _type: Type.Array,
    _description: 'List of other relationships',
    _default: [
      { uuid: '057de23f-3d9c-4314-9391-4452970739c6', display: 'Apoderado' },
      { uuid: 'a2b5c9f8-0d2a-4bdf-8d9b-6f3b2d1e5a2f', display: 'Otro' },
    ],
  },

  // 12. SYSTEM IDENTIFIERS
  defaulterTracingEncounterUuid: {
    _type: Type.String,
    _description: 'Encounter UUID for defaulter tracing',
    _default: '1495edf8-2df2-11e9-b210-d663bd873d93',
  },

  clinicalEncounterUuid: {
    _type: Type.String,
    _description: 'Clinical Encounter UUID',
    _default: '465a92f2-baf8-42e9-9612-53064be868e8',
  },

  registrationEncounterUuid: {
    _type: Type.String,
    _description: 'Registration encounter UUID',
    _default: 'de1f9d67-b73e-4e1b-90d0-036166fc6995',
  },

  defaultIDUuid: {
    _type: Type.String,
    _description: 'HSC Identifier UUID',
    _default: '05a29f94-c0ed-11e2-94be-8c13b969e334',
  },

  defaultIdentifierSourceUuid: {
    _type: Type.String,
    _description: 'IdGen de Identificador HSC',
    _default: '8549f706-7e85-4c1d-9424-217d50a2988b',
  },

  maritalStatusUuid: {
    _type: Type.String,
    _description: 'Marital status concept UUID',
    _default: 'aa345a81-3811-4e9c-be18-d6be727623e0',
  },

  hivProgramUuid: {
    _type: Type.String,
    _description: 'HIV Program UUID',
    _default: 'dfdc6d40-2f2f-463d-ba90-cc97350441a8',
  },

  // 13. CONTACT ATTRIBUTES
  contactPersonAttributesUuid: {
    _type: Type.Object,
    _description: 'Contact created patient attributes UUID',
    _default: {
      telephone: 'b2c38640-2603-4629-aebd-3b54f33f1e3a',
      baselineHIVStatus: '3ca03c84-632d-4e53-95ad-91f1bd9d96d6',
      contactCreated: '7c94bd35-fba7-4ef7-96f5-29c89a318fcf',
      preferedPnsAproach: '59d1b886-90c8-4f7f-9212-08b20a9ee8cf',
      livingWithContact: '35a08d84-9f80-4991-92b4-c4ae5903536e',
      contactipvOutcome: '49c543c2-a72a-4b0a-8cca-39c375c0726f',
    },
  },

  // 14. REGISTRATION CONFIGURATION
  registrationObs: {
    encounterTypeUuid: {
      _type: Type.UUID,
      _default: null,
      _description: 'Obs created during registration will be associated with an encounter of this type.',
    },
    encounterProviderRoleUuid: {
      _type: Type.UUID,
      _default: 'a0b03050-c99b-11e0-9572-0800200c9a66',
      _description: "Provider role to use for the registration encounter. Default is 'Unknown'.",
    },
    registrationFormUuid: {
      _type: Type.UUID,
      _default: null,
      _description: 'Form UUID to associate with the registration encounter.',
    },
  },

  // 15. LEGEND CONFIGURATION
  legend: {
    _type: Type.Object,
    _description: 'Configuration for legend display in UI components',
    colorDefinitions: {
      _type: Type.Array,
      _description: 'Array of concept UUIDs and their associated colors',
      _default: [],
      _elements: {
        _type: Type.Object,
        conceptUuid: {
          _type: Type.ConceptUuid,
          _description: 'UUID of the concept to associate with a color',
        },
        colour: {
          _type: Type.String,
          _description: 'CSS color value (e.g., hex, RGB, color name)',
        },
      },
    },
    legendConceptSet: {
      _type: Type.ConceptUuid,
      _description: 'UUID of the concept set used for legend items',
      _default: '',
    },
  },
};

// ===============================
// TYPE INTERFACES
// ===============================

export interface BiometricsConfigObject {
  bmiUnit: string;
  heightUnit: string;
  weightUnit: string;
}

export interface LegendConfigObject {
  legendConceptSet: string;
  colorDefinitions: Array<{
    conceptUuid: string;
    colour: string;
  }>;
}

export interface ConfigObject {
  conditionPageSize: number;
  conditionConceptClassUuid: string;
  conditionConceptSets: {
    antecedentesPatologicos: {
      uuid: string;
      title: string;
      description: string;
    };
  };
  conditionFreeTextFallbackConceptUuid: string;
  encounterTypes: {
    externalConsultation: string;
    specializedConsultation: string;
    triage: string;
    emergencyCare: string;
    hospitalization: string;
    hospitalDischarge: string;
    bedAssignment: string;
    intraHospitalTransfer: string;
    hospitalizationProgressNote: string;
    dentalCare: string;
    mentalHealthEvaluation: string;
    malnutritionAnemiaCare: string;
    chronicDiseaseFollowup: string;
    hivTestingServices: string;
    tbTreatmentSupervision: string;
    covid19Management: string;
    medicationPrescriptionDispensation: string;
    labResults: string;
    electiveAmbulatorySurgery: string;
    consultation: string;
    referralCounterReferral: string;
    transferRequest: string;
    encounterCancellation: string;
    healthEducationCounseling: string;
    clinicalFileUpload: string;
    order: string;
  };
  vitals: {
    useFormEngine: boolean;
    encounterTypeUuid: string;
    formUuid: string;
    formName: string;
    useMuacColors: boolean;
    showPrintButton: boolean;
  };
  biometrics: BiometricsConfigObject;
  caseManagementForms: Array<{
    id: string;
    title: string;
    formUuid: string;
    encounterTypeUuid: string;
  }>;
  formsList: {
    // Clinical Forms
    nursingAssessment: string;
    medicalOrders: string;
    medicalProgressNote: string;
    epicrisis: string;
    clinicalEncounterFormUuid: string;
    // Consulta Externa Forms
    consultaExternaForm: string;
    anamnesisForm: string;
    soapNoteForm: string;
    referralForm: string;
    // HIV/HTS Forms
    defaulterTracingFormUuid: string;
    htsScreening: string;
    htsInitialTest: string;
    htsRetest: string;
    // Hospital Forms
    medicalProgress: string;
    nursingNotes: string;
    therapeuticSheet: string;
    vitalSignsControl: string;
  };
  defaulterTracingEncounterUuid: string;
  clinicalEncounterUuid: string;
  concepts: Record<string, string>;
  specialClinics: Array<{
    id: string;
    formUuid: string;
    encounterTypeUuid: string;
    title: string;
  }>;
  registrationEncounterUuid: string;
  registrationObs: {
    encounterTypeUuid: string | null;
    encounterProviderRoleUuid: string;
    registrationFormUuid: string | null;
  };
  defaultIDUuid: string;
  maritalStatusUuid: string;
  defaultIdentifierSourceUuid: string;
  legend: LegendConfigObject;
  hivProgramUuid: string;
  contactPersonAttributesUuid: {
    telephone: string;
    baselineHIVStatus: string;
    contactCreated: string;
    preferedPnsAproach: string;
    livingWithContact: string;
    contactipvOutcome: string;
  };
  familyRelationshipsTypeList: Array<{
    uuid: string;
    display: string;
  }>;
  pnsRelationships: Array<{
    uuid: string;
    display: string;
    sexual: boolean;
  }>;
  otherRelationships: Array<{
    uuid: string;
    display: string;
  }>;
}
