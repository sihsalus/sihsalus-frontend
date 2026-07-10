import { Type } from '@openmrs/esm-framework';

import { CRED_NTS238_FORM_GROUPS } from './utils/cred-nts238-form-groups';

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
  // 1. ENCOUNTER TYPES
  encounterTypes: {
    _type: Type.Object,
    _description: 'List of encounter type UUIDs',
    _default: {
      //
      alojamientoConjunto: '984baa36-ee50-4693-92dd-82145be4847e',
      // Core Encounters
      externalConsultation: '186c1e78-a99f-4cd0-86de-b8c4ee27a2b5', // Consulta Externa — NTS 029
      specializedConsultation: 'e137c4de-8dbe-4d32-9a76-35f7d1b17f45', // Consulta Especializada — NTS 040
      triage: '67a71486-1a54-468f-ac3e-7091a9a79584',
      emergencyCare: '1b70fe57-92c1-4e35-87f7-13d0e04ff12f', // Atención en Emergencia — NTS 021

      // Hospitalization
      hospitalization: '8993b43c-7878-4e80-9257-1da45e84a904', // Hospitalización — NTS 032
      hospitalDischarge: '23bcca89-6dad-4a50-bed2-0ca224a9603f', // Alta Hospitalaria — NTS 032
      bedAssignment: '4c9dc097-a49a-464c-839a-612cc54943dc', // Asignación de Cama — NTS 032
      intraHospitalTransfer: 'c1c5747b-b705-4390-a9ee-27ba7c4b0794', // Traslado Intra-Hospitalario — NTS 032
      hospitalizationProgressNote: '3942f612-fea0-4414-b7a6-eaf24413e145', // Nota de Evolución — RM 546-2011

      // Maternal Health
      prenatalControl: '58a87b85-cb6c-4a4c-bc5f-0a2d1e0ff8ba',
      postnatalControl: '1bba4502-5493-4c41-8e29-71b81e137690', // Control Postnatal — NTS 050
      deliveryRoomCare: 'b212032f-9903-4696-ab31-173d432d1d3d', // Atención en Sala de Partos — NTS 050
      obstetricUltrasound: 'eb9c0ccb-c8c7-4e92-9346-d0c213d8ba9f', // Ecografía Obstétrica — NTS 050
      antecedentesPerinatales: 'a99e704f-46f6-4461-937d-606481fb0fc3',
      psicoprofilaxis: '3cde4d44-72f8-4aeb-9025-7a8906a56ae8',

      // Child Health
      healthyChildControl: 'a990eabc-3405-419f-bfb1-96ca2d8279b8', // Control CRED — NTS 238
      atencionInmediata: '83c8d2d0-4758-43b5-bba7-04aac5c08a07',
      cefaloCaudal: 'e0a6cba3-fa9c-4bf0-90b7-9d4d48401d1c',
      consejeriaMaterna: 'f90ac51d-bc0b-4551-a6f2-358e1a47751f',

      // Specialized Care
      dentalCare: '1a58800e-dc0d-49b3-abfa-5da144e08d00', // Atención de Odontología — NTS 040
      mentalHealthEvaluation: '1b9f21c5-928c-4077-bc95-dcd4b1a5a366', // Evaluación de Salud Mental — RM 856-2019
      malnutritionAnemiaCare: '91b5f447-e6f6-4ad0-8ec5-75151b46bd82', // Desnutrición y Anemia — NTS 102
      chronicDiseaseFollowup: '3a542b3a-79a8-4c97-a65b-d6ccc84171a7', // Seguimiento Enfermedades Crónicas — NTS 067
      hivTestingServices: '5cbb797f-bed5-4301-a3ce-6cc7eb7c687b', // Tamizaje de VIH — NTS 169
      tbTreatmentSupervision: 'a4133bfb-a43a-42ac-84a5-0367451e4f23', // DOT Tuberculosis — NTS 090
      covid19Management: '2314baf3-2876-4ff7-b7f2-a73e157eec57', // Manejo COVID-19 — NTS 094-2022

      // Medical Services
      medicationPrescriptionDispensation: '79488027-0292-4807-afe4-9c037052be40', // Prescripción y Dispensación — NTS 042
      labResults: '328f6f79-4a85-4ff8-9fb8-6b2c839c7649', // Resultados de Laboratorio — NTS 090
      vaccinationAdministration: '29c02aff-9a93-46c9-bf6f-48b552fcb1fa',
      electiveAmbulatorySurgery: 'a0a7d43a-1fd1-4df9-9429-a3e84f1d7c62', // Cirugía Ambulatoria Electiva — NTS 172

      // Administrative
      consultation: 'e4834799-7f43-4552-a6f3-2656880ca52f', // Interconsulta — NTS 102
      referralCounterReferral: '16bec8b6-4a2d-4cf9-8e66-9bb6e1c5d1da', // Referencia y Contrarreferencia — NTS 102
      transferRequest: '07d73526-c3c4-490e-9b0a-1cd884cc3822', // Solicitud de Traslado — NTS 102
      encounterCancellation: '46ee60b6-8212-4464-a592-d7371e8b3a48', // Anulación de Encuentro — RM 546-2011
      healthEducationCounseling: '54e3e45d-b7d7-4259-b64a-334e17b98c40', // Educación y Consejería — NTS 050
      clinicalFileUpload: '319dcd44-19c5-432c-9733-d1f3798fffd6', // Carga de Archivos Clínicos — RM 546-2011
      order: '39da3525-afe4-45ff-8977-c53b7b359158',
    },
  },

  // 2. FORMS CONFIGURATION
  formsList: {
    _type: Type.Object,
    _description: 'List of form identifiers. Values can be UUIDs or published OpenMRS form names.',
    _default: {
      // Maternal Forms
      prenatal: 'OBST-003-ATENCIÓN PRENATAL',
      postNatal: 'OBST-009-CONTROL DE PUERPERIO',
      maternalHistory: 'OBST-001-ANTECEDENTES',
      deliveryOrAbortion: 'OBST-005-PARTO O ABORTO',
      SummaryOfLaborAndPostpartum: 'HOSP-007-RESUMEN DE PARTO-POSTPARTO',
      currentPregnancy: 'OBST-002-EMBARAZO ACTUAL',
      prenatalCare: 'OBST-002-EMBARAZO ACTUAL',
      immediatePostpartumPeriod: 'OBST-006-PUERPERIO INMEDIATO',
      postpartumControl: 'OBST-009-CONTROL DE PUERPERIO',
      labourAndDelivery: 'OBST-005-PARTO O ABORTO',

      atencionPrenatal: 'OBST-003-ATENCIÓN PRENATAL',

      // CRED Forms
      atencionImmediataNewborn: '(Página 5) ATENCIÓN INMEDIATA DEL RECIÉN NACIDO',
      breastfeedingObservation:
        '(Página 8) Ficha de Observación del Amamantamiento de la Consejería en Lactancia Materna',
      newbornNeuroEval: '(Página 6) EVALUACIÓN CÉFALO-CAUDAL Y NEUROLÓGICO DEL RECIÉN NACIDO',
      roomingIn: '(Página 10) Alojamiento Conjunto',
      birthDetails: '(CRED) Detalles de Nacimiento',
      pregnancyDetails: '(CRED) Embarazo y Parto',

      // Legacy development forms retained only to resolve historical encounters; not routed by NTS 238.
      eedp2Months: 'Página (30, 31, 32 y 33) EEDP (2 meses)',
      eedp5Months: 'Página (30, 31, 32 y 33) EEDP (5 meses)',
      eedp8Months: 'Página (30, 31, 32 y 33) EEDP (8 meses)',
      eedp12Months: 'Página (30, 31, 32 y 33) EEDP (12 meses)',
      eedp15Months: 'Página (30, 31, 32 y 33) EEDP (15 meses)',
      eedp18Months: 'Página (30, 31, 32 y 33) EEDP (18 meses)',
      eedp21Months: 'Página (30, 31, 32 y 33) EEDP (21 meses)',
      tepsi: '1fe2f9e8-a9b1-34d2-94ce-b897ca2e16cc',

      // Assessment Forms
      riskInterview0to30: '(Página 19) PRIMERA ENTREVISTA EN BUSCA DE FACTORES DE RIESGO (0 - 30 meses)',
      childFeeding0to5: '(Página 20) Evaluación de la alimentación del niño/niña (0 - 5 meses)',
      childFeeding6to42: '(Página 20) Evaluación de la alimentación del niño/niña (6 - 42 meses)',
      childAbuseScreening: '(Página 37) Ficha de Tamizaje Violencia y maltrato infantil',

      // Clinical Forms
      nursingAssessment: '(Página 11 y 12) Valoración de Enfermería',
      medicalOrders: '(Página 13) Órdenes Médicas',
      medicalProgressNote: '(Página 14) Nota de Evolución Médica',
      epicrisis: '(Página 16) Epicrisis',

      // Hospital Forms
      puerperiumLab: '(Página 4 y 5) Puerperio - Laboratorio',
      obstetricMonitor: 'HOSP-011-HOJA DE MONITORIZACIÓN OBSTÉTRICA-PARTO',
      obstetricHistory: 'HOSP-002-HISTORIA CLÍNICA OBSTÉTRICA-PARTO',
      obstetricProgress: 'HOSP-005-EVOLUCIÓN OBSTÉTRICA-PARTO',
      obstetricAntecedents: 'OBST-001-ANTECEDENTES',
      medicalProgress: 'HOSP-004-EVOLUCIÓN MÉDICA',
      nursingNotes: 'HOSP-009-NOTAS DE ENFERMERÍA',
      therapeuticSheet: 'HOSP-008-HOJA TERAPÉUTICA',
      birthPlanForm: 'OBST-004-FICHA PLAN DE PARTO',
      vitalSignsControl: 'HOSP-001-CONTROL DE FUNCIONES VITALES',
      birthSummary: 'HOSP-007-RESUMEN DE PARTO-POSTPARTO',
      puerperiumEpicrisis: '(Página 12) Puerperio - Epicrisis',
      puerperiumDischarge: '(Página 14) Puerperio - Informe de Alta',
      clinicalHistory: 'HOSP-003-HISTORIA CLÍNICA OBSTÉTRICA - PARTO',

      // CRED Seguimiento Forms
      anemiaScreeningForm: 'CRED-001-TAMIZAJE DE ANEMIA',
      supplementationForm: 'CRED-002-SUPLEMENTACIÓN NIÑO',
      screeningIndicatorsForm: 'OBST-013-TAMIZAJE PRENATAL',
      stimulationSessionForm: 'CRED-003-SESIÓN DE ESTIMULACIÓN TEMPRANA',
      stimulationFollowupForm: 'CRED-004-SEGUIMIENTO DEL DESARROLLO',
      stimulationCounselingForm: 'CRED-005-CONSEJERÍA A PADRES',

      // Nutrición Infantil Forms
      nutritionalAssessmentForm: 'CRED-006-EVALUACIÓN NUTRICIONAL',
      feedingCounselingForm: 'CRED-007-CONSEJERÍA ALIMENTARIA',
      nutritionFollowupForm: 'CRED-008-SEGUIMIENTO NUTRICIONAL',
      ediDevelopmentForm: 'CRED-009-EDI',
      autismScreeningForm: 'CRED-010-TAMIZAJE TEA',
      childMentalHealthForm: 'CRED-011-SALUD MENTAL NIÑO Y CUIDADOR',
      parasitosisScreeningForm: 'CRED-012-DESCARTE DE PARASITOSIS',
      vitaminAAdministrationForm: 'CRED-013-ADMINISTRACIÓN DE VITAMINA A',
      physicalExamForm: 'CRED-014-EXAMEN FÍSICO INTEGRAL',
      growthNutritionEvaluationForm: 'CRED-015-CRECIMIENTO Y ESTADO NUTRICIONAL',
      oralHealthInspectionForm: 'CRED-016-INSPECCIÓN DE CAVIDAD BUCAL',
      visualScreeningForm: 'CRED-017-TAMIZAJE VISUAL',
      hearingScreeningForm: 'CRED-018-EVALUACIÓN AUDITIVA',
      cancerWarningSignsForm: 'CRED-019-SIGNOS DE SOSPECHA DE CÁNCER',
      metalsExposureScreeningForm: 'CRED-020-EXPOSICIÓN A METALES PESADOS',
      violenceDisciplineScreeningForm: 'CRED-021-VIOLENCIA DISCIPLINA Y CASTIGO FÍSICO',
      credCounselingAgreementForm: 'CRED-022-CONSEJERÍA ACUERDOS Y COMPROMISOS',
      homeVisitFollowupForm: 'CRED-023-VISITA DOMICILIARIA Y SEGUIMIENTO',
      referralInterconsultationForm: 'CRED-024-INTERCONSULTA DERIVACIÓN REFERENCIA',
      schoolHealthCounselingForm: 'CRED-025-CONSEJERÍA ESCOLAR Y LONCHERA SALUDABLE',
      huancaNeurodevelopmentForm: 'CRED-026-HUANCA TEST VIGILANCIA NEURODESARROLLO',
      expectedSkillsBehaviorsForm: 'CRED-027-LISTA HABILIDADES Y CONDUCTAS ESPERADAS',
      adverseReactionForm: 'INMU-002-REPORTE ESAVI',
    },
  },

  adverseReactionReporting: {
    _type: Type.Object,
    _description: 'Configuration for ESAVI/adverse vaccine reaction reporting as a normal OpenMRS encounter.',
    _default: {
      vaccineNameConceptUuid: 'f0000017-0000-4000-8000-000000000017',
      severityConceptUuid: 'f0000019-0000-4000-8000-000000000019',
      reactionDescriptionConceptUuid: 'f0000002-0000-4000-8000-000000000002',
      severityAnswers: {
        mild: 'f0000161-0000-4000-8000-000000000161',
        moderate: 'f0000162-0000-4000-8000-000000000162',
        severe: 'f0000163-0000-4000-8000-000000000163',
      },
    },
  },

  partography: {
    _type: Type.Object,
    _description: 'Configuración mínima del partograma publicado en hospitalización/obstetricia',
    _default: {
      encounterTypeUuid: 'b212032f-9903-4696-ab31-173d432d1d3d',
      formUuid: '7c441319-2e9d-3911-aa4b-2a4c71373a6f',
      progressConceptUuid: '56fdb8b4-4f2a-45f6-b720-7b76786c1ad1',
    },
    encounterTypeUuid: {
      _type: Type.UUID,
      _description: 'Encounter type UUID de atención en sala de partos usado para recuperar datos del partograma',
      _default: 'b212032f-9903-4696-ab31-173d432d1d3d',
    },
    formUuid: {
      _type: Type.UUID,
      _description: 'Form UUID del partograma',
      _default: '7c441319-2e9d-3911-aa4b-2a4c71373a6f',
    },
    progressConceptUuid: {
      _type: Type.ConceptUuid,
      _description: 'Concept UUID principal publicado en HOSP-006-PARTOGRAMA',
      _default: '56fdb8b4-4f2a-45f6-b720-7b76786c1ad1',
    },
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
      _default: '9da40eb7-927e-44e6-a981-2480c1f5386b',
    },
    formUuid: {
      _type: Type.UUID,
      _default: '9f26aad4-244a-46ca-be49-1196df1a8c9a',
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

  neonatalConcepts: {
    _type: Type.Object,
    _description: 'Concept UUIDs used by neonatal and well-child-care summary widgets.',
    _default: {
      skinColorUuid: 'c00971b1-029f-4160-9b68-55e101a512a8',
      fontanelleUuid: '52956c82-e8ad-4f85-8dd7-9b993f3d54df',
      suturesUuid: 'dde87a4f-cd8c-4fe7-b7ef-f0f43bb31637',
      earsUuid: '4b4f8ad4-a934-4ead-921a-266ca1d2102c',
      noseUuid: '313226d7-d67d-4246-8d84-62f7208badf5',
      mouthUuid: '1a512c73-916f-4df3-938d-6f2c3d705fc3',
      neckUuid: '7978016d-a854-427b-8451-9f6ca62b5186',
      thoraxUuid: '08579338-2599-438e-b3be-6cd3e7d955bd',
      nipplesUuid: '36094aaf-31f7-46e8-92f1-8e8f7b7181ec',
      clavicleUuid: '3d81681d-081e-4c31-ad24-d5faea4c2833',
      esophagusPermeabilityUuid: 'f49edae8-ea0c-4013-8452-4dde09d7f8a7',
      umbilicalCordUuid: '7f75f2a9-3531-4f9a-b2ac-eaf61d74f614',
      abdomenCharacteristicsUuid: '49d05fba-f1d0-4bb7-8b63-5084d78638e2',
      genitourinaryUuid: '57746a04-5f9e-4e42-9233-efeeeb3db0d0',
      observationUuid: 'f947a4ad-3d8d-4516-8e6b-67b3dca4e227',
      genitourinaryEliminationUuid: 'd79f07ac-bc26-4e3d-84d2-fb764da9409b',
      spinalColumnUuid: 'd5d244f7-911b-43ca-90a1-3001c167b342',
      limbsUuid: '46dc8706-c1af-4b04-b5d8-7432de862fef',
      muscleToneUuid: '0d73ab1a-faee-4774-b570-609d98d8f6e0',
      hipUuid: 'ca9f422f-f103-43c4-ae56-1b43bc2e7ec1',
      neurologicalEvaluationUuid: '7378ae3c-4a25-4d09-adbc-b3fe6b739aa3',
      immediateAssessmentUuid: '7dbb1546-3eef-4983-99ad-4c7f065cf093',
      birthQuestionnaireUuid: '517afc20-481d-4cdf-ba88-5641418aa762',
      newbornEvaluationUuid: 'ebe4e1c4-7f4f-4779-a8b3-8b2e5a5cc9b6',
      cordClampingUuid: 'b7f5376f-b025-4da5-80e2-bb20065a1b30',
      skinToSkinContactUuid: '3bbebee4-ccc8-4a01-a5e8-14f9222a6827',
      oxygenSupportUuid: '06e7e25f-23c5-4035-800a-d86f598d50cf',
      vitaminKAdminUuid: '5da8b9b1-f566-411f-b50b-f634ed6321c0',
      heartRateUuid: '5087AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      respiratoryRateUuid: '5242AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      oxygenSaturationUuid: '5092AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      bodyTemperatureUuid: '5088AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      apgar1MinUuid: 'a2010a1f-d7ca-4d6f-9255-f53da4fa5c3f',
      apgar5MinUuid: '0f3be2f6-986f-4928-8761-b531044c1f36',
      apgar10MinUuid: 'f621e8d3-2c34-48fc-95c1-50ad0606ed68',
      weightUuid: '5089AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      heightUuid: '3f85a289-bcb4-4d67-8053-7c8415e09aef',
      headCircumferenceUuid: 'c4d39248-c896-433a-bc69-e24d04b7f0e5',
      chestCircumferenceUuid: '911eb398-e7de-4270-af63-e4c615ec22a9',
      gastricLavageUuid: '0d17ad63-b1c0-46db-b8e7-c4c2d8343edf',
      gastricLavageCountUuid: '1c2e66e6-1a67-488c-a36b-e2f3536b72fe',
      nursingDiagnosisUuid: '8e779adc-c463-434a-9113-a74c5e12399d',
      gestationalAgeUuid: '2eb9b2c4-cd08-4e6f-a11f-e1e6dc3cb54f',
      birthWeightUuid: '5a7f6473-ce0b-4ae5-95e1-3cb93ffaae65',
      birthHeightUuid: 'bf82beb1-d3b8-400e-8160-90869cad8136',
      weightForGestationalAgeUuid: 'b73d4e54-1c0a-419e-a241-dae1724fe41f',
      congenitalDiseaseUuid: '437c0f8e-c7b5-4267-b291-f8534418c51c',
      roomingInUuid: '98360dd3-0000-4b58-a21c-fe0189302d1a',
      breastfeedingFirstHourUuid: '82821bfe-a9f3-425e-9287-579ba4660832',
      requiredHospitalizationUuid: '49011148-6906-4885-b0a8-da2a0f8fd24b',
      hospitalizationTimeUuid: '0b9dcf14-5acb-427b-a017-71794d320d22',
      admissionDateTimeUuid: '38d40f48-10cb-4d80-a269-ec00b0be0cd0',
      hematocritUuid: '9a9c73d0-76e6-4b84-b20c-dfe8efea9542',
      motherAgeUuid: 'dcc62b2c-2fc7-4053-9239-0e79335ecdbc',
      numberOfChildrenUuid: '6cce201f-26eb-46d0-a8cb-f17ef045af78',
      deliveryTypeAcUuid: '590f32e5-d78a-47c6-98fc-9e4ddb3e7ede',
      nipplesAcUuid: '84f9275b-5a46-4c5c-96f6-e3752e0652ab',
      milkProductionUuid: 'ed328efb-4ca4-475b-a610-05c142738e06',
      latchUuid: 'df387d42-759e-4968-9f84-731c0fa3a089',
      suctionAcUuid: '8c68ada1-17b0-4c97-a521-6e7d3024b8fd',
      swallowingUuid: '4f8eb241-0cb9-4c10-825a-61889a73c42f',
      nursingDiagnosisAcUuid: 'c20d1f4e-d19a-47b6-b545-181a85477187',
      nursingInterventionUuid: '47a5ae3a-36a8-422c-a0b0-9b18bb44655f',
      examDateUuid: '8b88b123-a28f-4d70-a86d-49fd322c46d5',
      bodyPositionUuid: 'a2fa14e7-cf20-494c-ae55-6d1a0d01171c',
      responsesUuid: '08aeaea7-6fb4-4346-9834-d137e8a9a503',
      affectiveBondUuid: '60c8d705-ed11-43f2-a9fe-85036fead073',
      anatomyUuid: '8be83572-62bc-47cf-8691-f04fdc33a882',
      suctionCounselUuid: 'a4c047c9-30f8-49f6-8fb9-43e15e91d18c',
      timeUuid: 'dfe757a2-b7c6-4081-a151-2d8a58e80115',
      feedingTimeUuid: '4cb55646-934c-44f5-a986-166654b44996',
      pregnancyNumberUuid: 'ae27daee-d2f3-4df3-8e07-eff75c81872e',
      prenatalCareNumberUuid: '9156b8d5-e5d3-4c2b-b8fc-1faafeda8f6c',
      prenatalCareLocationUuid: '52a2755e-7510-473e-96d9-4875d7435f8d',
      deliveryConditionUuid: '899e0cc8-5f6a-4334-b51d-c559f71ea550',
      deliveryLocationUuid: 'b4c79dec-245b-4d9f-ae52-2db757c4561a',
      deliveryAttendantUuid: 'cff0f194-0a8c-4f2c-bbe4-35b356b23d24',
    },
  },

  // 7. CONCEPTS CONFIGURATION
  concepts: {
    // Problem and Death Concepts
    probableCauseOfDeathConceptUuid: {
      _type: Type.ConceptUuid,
      _description: 'Causa probable de muerte registrada como texto a partir de entrevista o información no médica',
      _default: 'e71d57a1-435b-5cd6-a24f-7cc77e0f65a0',
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
    respiratoryRateUuid: {
      _type: Type.ConceptUuid,
      _default: '5242AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    },

    // Fluid Balance
    stoolCountUuid: {
      _type: Type.ConceptUuid,
      _description: 'Number of stools per day',
      _default: 'f2f19bb7-e92f-4658-bfc9-0dbf63837cca',
    },
    stoolGramsUuid: {
      _type: Type.ConceptUuid,
      _description: 'Weight of stool output in grams',
      _default: 'e2365f75-d2d5-4950-925c-d87ad9e6c4d3',
    },
    urineCountUuid: {
      _type: Type.ConceptUuid,
      _description: 'Number of urinations per day',
      _default: 'c3dd9ed2-592e-43a7-a1e8-e010b12f1dd0',
    },
    urineGramsUuid: {
      _type: Type.ConceptUuid,
      _description: 'Urine output in grams/mL',
      _default: '4a275a66-ea18-4ee6-a967-c2bc4a2ff607',
    },
    vomitCountUuid: {
      _type: Type.ConceptUuid,
      _description: 'Number of vomiting episodes per day',
      _default: '4249ecea-d5b1-4541-ba42-48e9f2f968cd',
    },
    vomitGramsMLUuid: {
      _type: Type.ConceptUuid,
      _description: 'Vomit output in grams/mL',
      _default: 'db881ca6-26ff-46df-aac5-3f9a0efd67d4',
    },

    // Anthropometric Measurements
    heightUuid: {
      _type: Type.ConceptUuid,
      _description: 'Height or length measurement of the patient',
      _default: '5090AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    },
    headCircumferenceUuid: {
      _type: Type.ConceptUuid,
      _description: 'Head circumference measurement of the patient',
      _default: 'c4d39248-c896-433a-bc69-e24d04b7f0e5',
    },
    chestCircumferenceUuid: {
      _type: Type.ConceptUuid,
      _description: 'Chest circumference measurement of the patient',
      _default: '911eb398-e7de-4270-af63-e4c615ec22a9',
    },

    // Newborn Concepts
    newbornVitalSignsConceptSetUuid: {
      _type: Type.ConceptUuid,
      _description: 'Datos Vitales Recien Nacido Vivo',
      _default: 'a855816a-8bc2-43c8-9cf7-80090dabc47d',
    },

    // CRED Controls
    // Use OCL external_id/OpenMRS UUIDs here. The OCL uuid field is internal/versioned.
    // Do not point these values at newbornVitalSignsConceptSetUuid: that UUID is a ConvSet, not a field concept.
    consultationTime: {
      _type: Type.ConceptUuid,
      _description: 'Hora de consulta CRED',
      _default: '2c67cd3d-407c-4f4d-bdf7-0f32b42ccfb4',
    },
    controlNumber: {
      _type: Type.ConceptUuid,
      _description: 'Número de control CRED; vacío hasta publicar/importar el concepto en content',
      _default: '',
    },
  },

  // 8. MATERNAL HEALTH (MADRE GESTANTE)
  madreGestante: {
    // Pregnancy History
    gravidezUuid: {
      _type: Type.ConceptUuid,
      _description: 'Número total de veces que una mujer ha estado embarazada (Gravidez)',
      _default: 'ae27daee-d2f3-4df3-8e07-eff75c81872e',
    },
    partoAlTerminoUuid: {
      _type: Type.ConceptUuid,
      _description: 'Número de partos a término (≥37 semanas de gestación)',
      _default: '8795c05b-f286-4d70-a1e6-69172e676f05',
    },
    partoPrematuroUuid: {
      _type: Type.ConceptUuid,
      _description: 'Número de partos prematuros (20-36 semanas de gestación)',
      _default: 'e08c2bfd-c3c9-4b46-afcf-e83e2a12c23f',
    },
    partoAbortoUuid: {
      _type: Type.ConceptUuid,
      _description: 'Número de abortos (pérdidas antes de las 20 semanas de gestación)',
      _default: 'dbfad4ff-1b0c-4823-b80a-3864e1d81e94',
    },
    partoNacidoVivoUuid: {
      _type: Type.ConceptUuid,
      _description: 'Número de nacidos vivos',
      _default: 'b553ce85-94e2-4755-b106-3befef127133',
    },
    partoNacidoMuertoUuid: {
      _type: Type.ConceptUuid,
      _description: 'Número de nacidos muertos',
      _default: '4dc3ee54-ba0c-49e7-b907-02aa727372f4',
    },

    // Concept Sets
    gtpalConceptSetUuid: {
      _type: Type.ConceptUuid,
      _description: 'Concept set para el sistema GTPAL (Gravidez, Términos, Prematuros, Abortos, Vivos)',
      _default: '43244943-3df5-4640-a348-9131c8e47857',
    },
    riskAntecedentsConceptSetUuid: {
      _type: Type.ConceptUuid,
      _description: 'Concept set para antecedentes de riesgo en el embarazo',
      _default: 'b20b322f-3d83-45aa-8169-a4a66afaf5f2',
    },

    // Gestational Age
    EGFechaUltimaRegla: {
      _type: Type.ConceptUuid,
      _description: 'Fecha de la última menstruación (FUR) para calcular la edad gestacional',
      _default: '57634c13-00a8-4764-93ec-dab90b6d20ce',
    },
  },

  // 9. CHILD HEALTH (CRED)
  CRED: {
    // Concept Sets
    perinatalConceptSetUuid: {
      _type: Type.ConceptUuid,
      _description: 'Concept set para antecedentes/riesgo perinatal en CRED',
      _default: '9dce2946-9fda-4d62-b68e-d62711801189',
    },

    // Newborn Care Procedures
    profilaxisOcularUuid: {
      _type: Type.ConceptUuid,
      _description: 'Profilaxis ocular',
      _default: '10c23f60-3310-4674-9e2e-bc3aa9aecced',
    },
    administraciNDeVitaminaKUuid: {
      _type: Type.ConceptUuid,
      _description: 'Administración de Vitamina k',
      _default: 'b696bb6f-dfe4-4a05-8309-3864d2d015f5',
    },
    administraciNDeVitaminaKDe05MgUuid: {
      _type: Type.ConceptUuid,
      _description: 'Administración de Vitamina K de 0.5 mg',
      _default: '54da62f5-c6e0-4772-b1c4-d9fd58527d12',
    },
    administraciNDeVitaminaKDe1MgUuid: {
      _type: Type.ConceptUuid,
      _description: 'Administración de Vitamina K de 1 mg',
      _default: 'db504b68-1b34-4859-afdb-76377649c3de',
    },

    // APGAR Scores
    apgarScoreAt1MinuteUuid: {
      _type: Type.ConceptUuid,
      _description: 'APGAR score at 1 minute',
      _default: 'a2010a1f-d7ca-4d6f-9255-f53da4fa5c3f',
    },
    apgarScoreAt5MinutesUuid: {
      _type: Type.ConceptUuid,
      _description: 'APGAR score at 5 minutes',
      _default: '0f3be2f6-986f-4928-8761-b531044c1f36',
    },
    apgarScoreAt10MinutesUuid: {
      _type: Type.ConceptUuid,
      _description: 'APGAR score at 10 minutes',
      _default: 'f621e8d3-2c34-48fc-95c1-50ad0606ed68',
    },

    // Physical Examination
    weightKgUuid: {
      _type: Type.ConceptUuid,
      _description: 'Weight',
      _default: '5089AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    },
    headCircumferenceUuid: {
      _type: Type.ConceptUuid,
      _description: 'Head circumference',
      _default: 'c4d39248-c896-433a-bc69-e24d04b7f0e5',
    },
    birthLengthUuid: {
      _type: Type.ConceptUuid,
      _description: 'Birth length',
      _default: '14e7654a-5448-40d8-a822-aa2438468d63',
    },
    perMetroTorCicoCmUuid: {
      _type: Type.ConceptUuid,
      _description: 'Perímetro Torácico (cm)',
      _default: '911eb398-e7de-4270-af63-e4c615ec22a9',
    },

    // Vital Signs
    temperaturaCUuid: {
      _type: Type.ConceptUuid,
      _description: 'Temperatura (C°)',
      _default: '5088AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    },
    pulseUuid: {
      _type: Type.ConceptUuid,
      _description: 'Pulse',
      _default: '5087AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    },
    respiratoryRateUuid: {
      _type: Type.ConceptUuid,
      _description: 'Respiratory rate',
      _default: '5242AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    },
    arterialBloodOxygenSaturationPulseOximeterUuid: {
      _type: Type.ConceptUuid,
      _description: 'Arterial blood oxygen saturation (pulse oximeter)',
      _default: '5092AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    },

    // Neurological Assessment
    valoraciNNeurolGicaDelReciNNacidoUuid: {
      _type: Type.ConceptUuid,
      _description: 'Valoración Neurológica del Recién Nacido',
      _default: '7378ae3c-4a25-4d09-adbc-b3fe6b739aa3',
    },
    tonoMuscularUuid: {
      _type: Type.ConceptUuid,
      _description: 'Tono muscular',
      _default: '0d73ab1a-faee-4774-b570-609d98d8f6e0',
    },
    buenTonoMuscularUuid: {
      _type: Type.ConceptUuid,
      _description: 'Buen tono muscular',
      _default: '7d3f083e-2de8-4e7b-b7e4-f81a97caa469',
    },

    // Reflexes
    reflejoDeSucciNUuid: {
      _type: Type.ConceptUuid,
      _description: 'Reflejo de Succión',
      _default: 'b76fe27e-4ca3-426a-bfb2-e7a49569c713',
    },
    reflejoDeDegluciNUuid: {
      _type: Type.ConceptUuid,
      _description: 'Reflejo de Deglución',
      _default: '2e60bebc-8be0-4108-978e-fe11cff9dd04',
    },
    reflejoDeBSquedaUuid: {
      _type: Type.ConceptUuid,
      _description: 'Reflejo de Búsqueda',
      _default: 'd6838254-89e6-43db-a8ee-e4e49f36047e',
    },
    reflejoDePresiNPlantarUuid: {
      _type: Type.ConceptUuid,
      _description: 'Reflejo de Presión Plantar',
      _default: '471bcb1a-088a-49b9-a896-e1a7f486e0c5',
    },
    reflejoDeMarchaAutomTicaUuid: {
      _type: Type.ConceptUuid,
      _description: 'Reflejo de Marcha Automática',
      _default: 'e6d349d2-fad5-4322-9c09-ec612cf1fdd9',
    },
    reflejoMoroUuid: {
      _type: Type.ConceptUuid,
      _description: 'Reflejo Moro',
      _default: 'dc1d326f-d116-4b35-ba56-f99a981097d9',
    },

    // Physical Characteristics
    colorDePielUuid: {
      _type: Type.ConceptUuid,
      _description: 'Color de Piel',
      _default: 'c00971b1-029f-4160-9b68-55e101a512a8',
    },
    pinkUuid: {
      _type: Type.ConceptUuid,
      _description: 'Pink',
      _default: 'bfef8539-e00b-4c81-b3c8-79af87562e24',
    },
    pLidoUuid: {
      _type: Type.ConceptUuid,
      _description: 'Pálido',
      _default: 'f2eae333-7cbf-434c-a8e9-d4ec0126d161',
    },
    cianTicoUuid: {
      _type: Type.ConceptUuid,
      _description: 'Cianótico',
      _default: 'dacb38a4-3a5a-4943-8618-396bfb4f4a1f',
    },

    // Anatomical Assessment
    bocaUuid: {
      _type: Type.ConceptUuid,
      _description: 'Boca',
      _default: '1a512c73-916f-4df3-938d-6f2c3d705fc3',
    },
    noseUuid: {
      _type: Type.ConceptUuid,
      _description: 'Nose',
      _default: '313226d7-d67d-4246-8d84-62f7208badf5',
    },
    orejasUuid: {
      _type: Type.ConceptUuid,
      _description: 'Orejas',
      _default: '4b4f8ad4-a934-4ead-921a-266ca1d2102c',
    },
    cuelloUuid: {
      _type: Type.ConceptUuid,
      _description: 'Cuello',
      _default: '7978016d-a854-427b-8451-9f6ca62b5186',
    },
    extremidadesUuid: {
      _type: Type.ConceptUuid,
      _description: 'Extremidades',
      _default: '46dc8706-c1af-4b04-b5d8-7432de862fef',
    },
    caderaUuid: {
      _type: Type.ConceptUuid,
      _description: 'Cadera',
      _default: 'ca9f422f-f103-43c4-ae56-1b43bc2e7ec1',
    },

    // Additional Assessment Concepts
    kawaidaUuid: {
      _type: Type.ConceptUuid,
      _description: 'Kawaida',
      _default: 'f35aa4ba-9d04-4283-a4c8-ec8f2ee29da5',
    },
    mamilasUuid: {
      _type: Type.ConceptUuid,
      _description: 'Mamilas',
      _default: '36094aaf-31f7-46e8-92f1-8e8f7b7181ec',
    },
    softAbdomenUuid: {
      _type: Type.ConceptUuid,
      _description: 'Soft abdomen',
      _default: '7160ba29-8f60-440e-aad5-8bec6ab862c1',
    },
    columnaVertebralUuid: {
      _type: Type.ConceptUuid,
      _description: 'Columna vertebral',
      _default: 'd5d244f7-911b-43ca-90a1-3001c167b342',
    },

    // Additional concepts continue with same pattern...
    // (Truncated for brevity - the remaining CRED concepts would follow the same organization)
  },

  // 10A. TAMIZAJE DE ANEMIA (NTS 213 y RM 429-2024)
  anemiaScreening: {
    _type: Type.Object,
    _description: 'Configuración del tamizaje de anemia según NTS 213 y RM 429-2024',
    _default: {
      hemoglobinaConceptUuid: '0ffe780c-a3ee-4c9c-b4dd-bf2e0f79dc7f',
    },
    hemoglobinaConceptUuid: {
      _type: Type.ConceptUuid,
      _description: 'Concept UUID para valor de hemoglobina (g/dL) — OCL: Hemoglobina #655',
      _default: '0ffe780c-a3ee-4c9c-b4dd-bf2e0f79dc7f',
    },
  },

  // 10B. SUPLEMENTACIÓN (Directiva 068 niño / Directiva 069 gestante)
  supplementation: {
    _type: Type.Object,
    _description: 'Configuración de suplementación MMN y prenatal',
    _default: {
      mmnConceptUuid: 'c2010002-0000-4000-8000-000000000002',
      mmnTotalTarget: 360,
      ironConceptUuid: '03a4f101-bf46-4923-97a1-759d926dee00',
      folicAcidConceptUuid: '7418c3a3-4c2a-4943-91db-ae2b561d6ded',
      calciumConceptUuid: '15df7b2b-ad43-410e-9edb-d1f40320faf4',
    },
    mmnConceptUuid: {
      _type: Type.ConceptUuid,
      _description: 'Concept UUID de cantidad de multimicronutrientes entregados en CRED-002',
      _default: 'c2010002-0000-4000-8000-000000000002',
    },
    mmnTotalTarget: {
      _type: Type.Number,
      _description: 'Meta total de sobres MMN (Directiva 068: 360)',
      _default: 360,
    },
    ironConceptUuid: {
      _type: Type.ConceptUuid,
      _description: 'Concept UUID de indicación fierro/ácido fólico — OCL: Indicación Fierro/Acido Fólico #2112',
      _default: '03a4f101-bf46-4923-97a1-759d926dee00',
    },
    folicAcidConceptUuid: {
      _type: Type.ConceptUuid,
      _description: 'Concept UUID de indicación ácido fólico — OCL: Indicación Acido Fólico #2114',
      _default: '7418c3a3-4c2a-4943-91db-ae2b561d6ded',
    },
    calciumConceptUuid: {
      _type: Type.ConceptUuid,
      _description: 'Concept UUID de indicación calcio — OCL: Indicación Calcio #2113',
      _default: '15df7b2b-ad43-410e-9edb-d1f40320faf4',
    },
  },

  // 10C. PLAN DE PARTO (NTS 105)
  birthPlan: {
    _type: Type.Object,
    _description: 'Configuración del plan de parto según NTS 105',
    _default: {
      encounterTypeUuid: '58a87b85-cb6c-4a4c-bc5f-0a2d1e0ff8ba',
      formUuid: '',
      indicatorConceptUuid: '47bb64cf-f63c-46a0-839a-9573bcedf9be',
      transportConceptUuid: '830ecf86-edd6-41dd-9211-7785a930e995',
      referenceHospitalConceptUuid: 'fb3f4592-1ec5-4bb0-a7ea-4864df29afd1',
    },
    encounterTypeUuid: {
      _type: Type.UUID,
      _description: 'Encounter type UUID para plan de parto (usa Control Prenatal)',
      _default: '58a87b85-cb6c-4a4c-bc5f-0a2d1e0ff8ba',
    },
    formUuid: {
      _type: Type.UUID,
      _description: 'Form UUID (Ampath) del plan de parto. Ver formsList.birthPlanForm = OBST-004-FICHA PLAN DE PARTO',
      _default: '',
    },
    indicatorConceptUuid: {
      _type: Type.ConceptUuid,
      _description: 'Concept UUID del indicador de plan de parto — OCL: Plan de Parto #1608',
      _default: '47bb64cf-f63c-46a0-839a-9573bcedf9be',
    },
    transportConceptUuid: {
      _type: Type.ConceptUuid,
      _description:
        'Concept UUID de transporte planificado al parto — OCL: Transporte planificado al parto #1053 (Coded)',
      _default: '830ecf86-edd6-41dd-9211-7785a930e995',
    },
    referenceHospitalConceptUuid: {
      _type: Type.ConceptUuid,
      _description: 'Concept UUID del establecimiento de referencia — OCL: Establecimiento de referencia #1103 (Text)',
      _default: 'fb3f4592-1ec5-4bb0-a7ea-4864df29afd1',
    },
  },

  // 10D. TAMIZAJE PRENATAL (NTS 159 - VIH/Sífilis/HepB)
  prenatalScreening: {
    _type: Type.Object,
    _description: 'Concepts de tamizaje prenatal obligatorio (NTS 159)',
    _default: {
      vihResultConceptUuid: 'afc399df-0376-4e3a-a8f5-cac6aa2d4bb9',
      sifilisResultConceptUuid: '7218b021-712f-49d8-b733-76bf899c1bde',
      hepatitisBResultConceptUuid: '6d2eaa49-ea92-4404-a5be-5f7081e6c6d5',
    },
    vihResultConceptUuid: {
      _type: Type.ConceptUuid,
      _description: 'Concept UUID del resultado de prueba rápida VIH — OCL: Prueba rápida VIH #330',
      _default: 'afc399df-0376-4e3a-a8f5-cac6aa2d4bb9',
    },
    sifilisResultConceptUuid: {
      _type: Type.ConceptUuid,
      _description: 'Concept UUID del resultado de RPR/VDRL (sífilis) — OCL: Prueba sífilis VDRL #652',
      _default: '7218b021-712f-49d8-b733-76bf899c1bde',
    },
    hepatitisBResultConceptUuid: {
      _type: Type.ConceptUuid,
      _description: 'Concept UUID del resultado de HBsAg (Hepatitis B) — OCL: Prueba rápida Ags HB #4310',
      _default: '6d2eaa49-ea92-4404-a5be-5f7081e6c6d5',
    },
  },

  // 10E. PSICOPROFILAXIS (RM 361-2011)
  psychoprophylaxis: {
    _type: Type.Object,
    _description: 'Configuración de psicoprofilaxis obstétrica',
    _default: {
      encounterTypeUuid: '3cde4d44-72f8-4aeb-9025-7a8906a56ae8',
      conceptUuid: 'b6927730-62ef-47a0-80d1-b1926ccea1b8',
      totalSessionsRequired: 6,
    },
    encounterTypeUuid: {
      _type: Type.UUID,
      _description: 'Encounter type UUID para sesiones de psicoprofilaxis — Sesión de Psicoprofilaxis (RM 361-2011)',
      _default: '3cde4d44-72f8-4aeb-9025-7a8906a56ae8',
    },
    conceptUuid: {
      _type: Type.ConceptUuid,
      _description: 'Concept UUID de psicoprofilaxis obstétrica',
      _default: 'b6927730-62ef-47a0-80d1-b1926ccea1b8',
    },
    totalSessionsRequired: {
      _type: Type.Number,
      _description: 'Número total de sesiones requeridas (RM 361-2011: 6)',
      _default: 6,
    },
  },

  // 10F. RIESGO OBSTÉTRICO (NTS 105)
  obstetricRisk: {
    _type: Type.Object,
    _description: 'Configuración de clasificación de riesgo obstétrico',
    _default: {
      classificationConceptUuid: '6b38e548-6cbb-456a-ae5d-51eecba16651',
      highRiskConceptUuid: '42fb3768-988c-4793-a0ee-aeee1dad1c73',
      lowRiskConceptUuid: '5e3ec0eb-9aff-487b-8356-7971f0a08e27',
      veryHighRiskConceptUuid: '3cfa8293-9bfb-4eca-92ed-9c3be0ffc8b2',
      riskFactorsConceptUuid: '601c996b-1edb-4406-948a-2ba4cc26789a',
    },
    classificationConceptUuid: {
      _type: Type.ConceptUuid,
      _description: 'Concept UUID de Grupo de Riesgo — OCL: Grupo de Riesgo #1530 (Coded)',
      _default: '6b38e548-6cbb-456a-ae5d-51eecba16651',
    },
    highRiskConceptUuid: {
      _type: Type.ConceptUuid,
      _description: 'Concept UUID para "Riesgo Sanitario Alto"',
      _default: '42fb3768-988c-4793-a0ee-aeee1dad1c73',
    },
    lowRiskConceptUuid: {
      _type: Type.ConceptUuid,
      _description: 'Concept UUID para "Riesgo Sanitario Mínimo"',
      _default: '5e3ec0eb-9aff-487b-8356-7971f0a08e27',
    },
    veryHighRiskConceptUuid: {
      _type: Type.ConceptUuid,
      _description: 'Concept UUID para "Riesgo Sanitario Muy Alto"',
      _default: '3cfa8293-9bfb-4eca-92ed-9c3be0ffc8b2',
    },
    riskFactorsConceptUuid: {
      _type: Type.ConceptUuid,
      _description:
        'Concept UUID de factores de riesgo obstétrico (23 answers) — OCL: Motivo derivación casa espera #378 (Coded)',
      _default: '601c996b-1edb-4406-948a-2ba4cc26789a',
    },
  },

  // 10G. NUTRICIÓN INFANTIL (NTS 238)
  childNutrition: {
    _type: Type.Object,
    _description: 'Concepts para evaluación y seguimiento nutricional infantil',
    _default: {
      nutritionClassificationConceptUuid: 'f0000009-0000-4000-8000-000000000009',
      weightConceptUuid: '5089AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      heightConceptUuid: '5090AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      feedingAssessmentConceptUuid: '6d411bf5-4391-4f4b-8ec6-7f789be9a237',
      breastfeedingAnswerConceptUuid: '90dc11d9-7af3-49ed-81be-979c3da72649',
      mmnReceivingConceptUuid: 'c2010002-0000-4000-8000-000000000002',
      ironReceivingConceptUuid: 'c2010003-0000-4000-8000-000000000003',
      nutritionCounselingConceptUuid: 'c2010004-0000-4000-8000-000000000004',
    },
    nutritionClassificationConceptUuid: {
      _type: Type.ConceptUuid,
      _description: 'Concept UUID de clasificación nutricional actual en CRED-006/CRED-008',
      _default: 'f0000009-0000-4000-8000-000000000009',
    },
    weightConceptUuid: {
      _type: Type.ConceptUuid,
      _description: 'Concept UUID de peso registrado en CRED-006/CRED-015',
      _default: '5089AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    },
    heightConceptUuid: {
      _type: Type.ConceptUuid,
      _description: 'Concept UUID de talla registrada en CRED-006/CRED-015',
      _default: '5090AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    },
    feedingAssessmentConceptUuid: {
      _type: Type.ConceptUuid,
      _description: 'Concept UUID de evaluación de alimentación del niño — OCL: #2279 (Coded, 17 Q-AND-A)',
      _default: '6d411bf5-4391-4f4b-8ec6-7f789be9a237',
    },
    breastfeedingAnswerConceptUuid: {
      _type: Type.ConceptUuid,
      _description: 'Answer concept UUID de lactancia materna dentro de la evaluación de alimentación',
      _default: '90dc11d9-7af3-49ed-81be-979c3da72649',
    },
    mmnReceivingConceptUuid: {
      _type: Type.ConceptUuid,
      _description: 'Concept UUID de cantidad de micronutrientes recibidos en CRED-002',
      _default: 'c2010002-0000-4000-8000-000000000002',
    },
    ironReceivingConceptUuid: {
      _type: Type.ConceptUuid,
      _description: 'Concept UUID de cantidad de hierro recibida en CRED-002',
      _default: 'c2010003-0000-4000-8000-000000000003',
    },
    nutritionCounselingConceptUuid: {
      _type: Type.ConceptUuid,
      _description: 'Concept UUID de consejería nutricional brindada en CRED-002',
      _default: 'c2010004-0000-4000-8000-000000000004',
    },
  },

  // 10H. ESTIMULACIÓN TEMPRANA (NTS 238)
  earlyStimulation: {
    _type: Type.Object,
    _description: 'Concepts para estimulación temprana y seguimiento del desarrollo',
    _default: {
      developmentEvalConceptUuid: 'c3010007-0000-4000-8000-000000000007',
      tepsiCoordinationConceptUuid: 'ecc332d2-6ca1-4238-ac14-d0de521bdb11',
      tepsiMotorConceptUuid: '7aec4f14-e2fb-4489-bcc5-50c7bf609a5b',
      stimulationLackConceptUuid: 'c4010002-0000-4000-8000-000000000002',
      counselingConceptUuid: 'c5010001-0000-4000-8000-000000000001',
    },
    developmentEvalConceptUuid: {
      _type: Type.ConceptUuid,
      _description: 'Concept UUID de actividades realizadas en CRED-003 sesión de estimulación temprana',
      _default: 'c3010007-0000-4000-8000-000000000007',
    },
    tepsiCoordinationConceptUuid: {
      _type: Type.ConceptUuid,
      _description: 'Concept UUID legado de coordinación TEPSI, solo para lectura histórica — OCL: #2195 (Coded)',
      _default: 'ecc332d2-6ca1-4238-ac14-d0de521bdb11',
    },
    tepsiMotorConceptUuid: {
      _type: Type.ConceptUuid,
      _description: 'Concept UUID legado de motricidad TEPSI, solo para lectura histórica — OCL: #2196 (Coded)',
      _default: '7aec4f14-e2fb-4489-bcc5-50c7bf609a5b',
    },
    stimulationLackConceptUuid: {
      _type: Type.ConceptUuid,
      _description: 'Concept UUID de clasificación del desarrollo en CRED-004; riesgo/retraso indican alerta',
      _default: 'c4010002-0000-4000-8000-000000000002',
    },
    counselingConceptUuid: {
      _type: Type.ConceptUuid,
      _description: 'Concept UUID de tema de consejería en CRED-005',
      _default: 'c5010001-0000-4000-8000-000000000001',
    },
  },

  // 10. AGE GROUPS CONFIGURATION
  ageGroupsCRED: {
    _type: Type.Array,
    _description: 'Configuración de grupos etarios para CRED',
    _default: [
      { label: 'RN - 3 a 6d', sublabel: 'CONTROL 1 (3 A 6 DÍAS)', minDays: 0, maxDays: 6, neonatalControl: 1 },
      { label: 'RN - 7 a 13d', sublabel: 'CONTROL 2 (7 A 13 DÍAS)', minDays: 7, maxDays: 13, neonatalControl: 2 },
      { label: 'RN - 14 a 21d', sublabel: 'CONTROL 3 (14 A 21 DÍAS)', minDays: 14, maxDays: 28, neonatalControl: 3 },
      { label: '0 AÑOS', sublabel: '1 A 11 MESES', minMonths: 1, maxMonths: 12 },
      { label: '1 AÑO', sublabel: '12 A 23 MESES', minMonths: 12, maxMonths: 24 },
      { label: '2 AÑOS', sublabel: '24 A 35 MESES', minMonths: 24, maxMonths: 36 },
      { label: '3 AÑOS', sublabel: '36 A 47 MESES', minMonths: 36, maxMonths: 48 },
      { label: '4 AÑOS', sublabel: '48 A 59 MESES', minMonths: 48, maxMonths: 60 },
      { label: '5 AÑOS', minMonths: 60, maxMonths: 72 },
      { label: '6 AÑOS', minMonths: 72, maxMonths: 84 },
      { label: '7 AÑOS', minMonths: 84, maxMonths: 96 },
      { label: '8 AÑOS', minMonths: 96, maxMonths: 108 },
      { label: '9 AÑOS', minMonths: 108, maxMonths: 120 },
      { label: '10 AÑOS', minMonths: 120, maxMonths: 132 },
      { label: '11 AÑOS', minMonths: 132, maxMonths: 144 },
    ],
    _elements: {
      _type: Type.Object,
      label: { _type: Type.String },
      sublabel: { _type: Type.String, _optional: true },
      minDays: { _type: Type.Number, _optional: true },
      maxDays: { _type: Type.Number, _optional: true },
      minMonths: { _type: Type.Number, _optional: true },
      maxMonths: { _type: Type.Number, _optional: true },
      neonatalControl: { _type: Type.Number, _optional: true },
    },
  },

  // 11. CRED SCHEDULING CONFIGURATION
  credScheduling: {
    _type: Type.Object,
    _description: 'Configuración para la programación de controles CRED',
    appointmentServiceUuid: {
      _type: Type.UUID,
      _description: 'UUID del AppointmentService para controles CRED',
      _default: '',
    },
    lookaheadCount: {
      _type: Type.Number,
      _description: 'Cantidad de citas futuras a generar por defecto',
      _default: 3,
    },
    defaultAppointmentDurationMins: {
      _type: Type.Number,
      _description: 'Duración por defecto de citas CRED en minutos',
      _default: 30,
    },
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
    _default: '1eb6833d-fc44-4d2c-b243-ddab949479b3',
  },

  // 13. CONTACT ATTRIBUTES
  contactPersonAttributesUuid: {
    _type: Type.Object,
    _description: 'Contact created patient attributes UUID',
    _default: {
      telephone: '14d4f066-15f5-102d-96e4-000c29c2a5d7',
      baselineHIVStatus: 'b978d331-e162-45b1-b9ca-65d3aa9a851f',
      contactCreated: 'e91775be-cf11-45e3-9b34-3c3f8849d4d6',
      preferedPnsAproach: '98c0a958-515e-4dec-a771-7a4cb9aa5492',
      livingWithContact: '1a951a91-231f-4a3a-9a22-e396fa93455c',
      contactipvOutcome: '81a8b164-befa-4cac-8978-da059082297c',
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

  // 17. CRED FORMS BY AGE GROUP CONFIGURATION
  CREDFormsByAgeGroup: {
    _type: Type.Array,
    _description: 'Configuración de formularios CRED por grupo etario',
    _default: CRED_NTS238_FORM_GROUPS,
    _elements: {
      _type: Type.Object,
      label: { _type: Type.String },
      minDays: { _type: Type.Number, _optional: true },
      maxDays: { _type: Type.Number, _optional: true },
      neonatalControl: { _type: Type.Number, _optional: true },
      minMonths: { _type: Type.Number, _optional: true },
      maxMonths: { _type: Type.Number, _optional: true },
      forms: { _type: Type.Array, _elements: { _type: Type.String } },
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

export interface PartographyConfigObject {
  encounterTypeUuid: string;
  formUuid: string;
  progressConceptUuid: string;
}

export interface PartograpyComponents {
  id: string;
  date: string;
  fetalHeartRate: number;
  cervicalDilation: number;
  descentOfHead: string;
  contractionFrequency?: number;
  contractionDuration?: number;
}

export interface AgeRange {
  label: string;
  sublabel?: string;
  minDays?: number;
  maxDays?: number;
  minMonths?: number;
  maxMonths?: number;
  neonatalControl?: number;
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
  encounterTypes: {
    alojamientoConjunto: string;
    specializedConsultation: string;
    triage: string;
    deliveryRoomCare: string;
    hivTestingServices: string;
    prenatalControl: string;
    postnatalControl: string;
    healthyChildControl: string;
    dentalCare: string;
    malnutritionAnemiaCare: string;
    obstetricUltrasound: string;
    externalConsultation: string;
    hospitalization: string;
    hospitalDischarge: string;
    emergencyCare: string;
    chronicDiseaseFollowup: string;
    mentalHealthEvaluation: string;
    medicationPrescriptionDispensation: string;
    antecedentesPerinatales: string;
    labResults: string;
    vaccinationAdministration: string;
    healthEducationCounseling: string;
    consultation: string;
    referralCounterReferral: string;
    intraHospitalTransfer: string;
    bedAssignment: string;
    hospitalizationProgressNote: string;
    transferRequest: string;
    encounterCancellation: string;
    clinicalFileUpload: string;
    atencionInmediata: string;
    tbTreatmentSupervision: string;
    covid19Management: string;
    electiveAmbulatorySurgery: string;
    order: string;
    cefaloCaudal: string;
    consejeriaMaterna: string;
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
  madreGestante: Record<string, string>;
  CRED: Record<string, string>;
  formsList: {
    prenatal: string;
    postNatal: string;
    labourAndDelivery: string;
    atencionPrenatal: string;
    atencionImmediataNewborn: string;
    maternalHistory: string;
    deliveryOrAbortion: string;
    SummaryOfLaborAndPostpartum: string;
    currentPregnancy: string;
    prenatalCare: string;
    immediatePostpartumPeriod: string;
    postpartumControl: string;
    breastfeedingObservation: string;
    eedp12Months: string;
    tepsi: string;
    medicalProgressNote: string;
    eedp5Months: string;
    eedp21Months: string;
    nursingAssessment: string;
    medicalOrders: string;
    newbornNeuroEval: string;
    eedp15Months: string;
    riskInterview0to30: string;
    eedp8Months: string;
    roomingIn: string;
    eedp18Months: string;
    eedp2Months: string;
    childFeeding6to42: string;
    childAbuseScreening: string;
    epicrisis: string;
    childFeeding0to5: string;
    birthDetails: string;
    pregnancyDetails: string;
    puerperiumLab: string;
    obstetricMonitor: string;
    obstetricHistory: string;
    obstetricProgress: string;
    obstetricAntecedents: string;
    medicalProgress: string;
    nursingNotes: string;
    therapeuticSheet: string;
    birthPlanForm: string;
    vitalSignsControl: string;
    birthSummary: string;
    puerperiumEpicrisis: string;
    puerperiumDischarge: string;
    clinicalHistory: string;
    anemiaScreeningForm: string;
    supplementationForm: string;
    screeningIndicatorsForm: string;
    stimulationSessionForm: string;
    stimulationFollowupForm: string;
    stimulationCounselingForm: string;
    nutritionalAssessmentForm: string;
    feedingCounselingForm: string;
    nutritionFollowupForm: string;
    ediDevelopmentForm: string;
    autismScreeningForm: string;
    childMentalHealthForm: string;
    parasitosisScreeningForm: string;
    vitaminAAdministrationForm: string;
    physicalExamForm: string;
    growthNutritionEvaluationForm: string;
    oralHealthInspectionForm: string;
    visualScreeningForm: string;
    hearingScreeningForm: string;
    cancerWarningSignsForm: string;
    metalsExposureScreeningForm: string;
    violenceDisciplineScreeningForm: string;
    credCounselingAgreementForm: string;
    homeVisitFollowupForm: string;
    referralInterconsultationForm: string;
    schoolHealthCounselingForm: string;
    huancaNeurodevelopmentForm: string;
    expectedSkillsBehaviorsForm: string;
    adverseReactionForm: string;
  };
  adverseReactionReporting: {
    vaccineNameConceptUuid: string;
    severityConceptUuid: string;
    reactionDescriptionConceptUuid: string;
    severityAnswers: {
      mild: string;
      moderate: string;
      severe: string;
    };
  };
  neonatalConcepts: Record<string, string>;
  clinicalEncounterUuid: string;
  concepts: Record<string, string>;
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
  partography: PartographyConfigObject;
  contactPersonAttributesUuid: {
    telephone: string;
    baselineHIVStatus: string;
    contactCreated: string;
    preferedPnsAproach: string;
    livingWithContact: string;
    contactipvOutcome: string;
  };
  CREDFormsByAgeGroup;
  ageGroupsCRED: AgeRange[];

  // Fase 1 — Config sections normativos
  anemiaScreening: {
    hemoglobinaConceptUuid: string;
  };
  supplementation: {
    mmnConceptUuid: string;
    mmnTotalTarget: number;
    ironConceptUuid: string;
    folicAcidConceptUuid: string;
    calciumConceptUuid: string;
  };
  birthPlan: {
    encounterTypeUuid: string;
    formUuid: string;
    indicatorConceptUuid: string;
    transportConceptUuid: string;
    referenceHospitalConceptUuid: string;
  };
  prenatalScreening: {
    vihResultConceptUuid: string;
    sifilisResultConceptUuid: string;
    hepatitisBResultConceptUuid: string;
  };
  psychoprophylaxis: {
    encounterTypeUuid: string;
    conceptUuid: string;
    totalSessionsRequired: number;
  };
  obstetricRisk: {
    classificationConceptUuid: string;
    highRiskConceptUuid: string;
    lowRiskConceptUuid: string;
    veryHighRiskConceptUuid: string;
    riskFactorsConceptUuid: string;
  };
  credScheduling: {
    appointmentServiceUuid: string;
    lookaheadCount: number;
    defaultAppointmentDurationMins: number;
  };
  childNutrition: {
    nutritionClassificationConceptUuid: string;
    weightConceptUuid: string;
    heightConceptUuid: string;
    feedingAssessmentConceptUuid: string;
    breastfeedingAnswerConceptUuid: string;
    mmnReceivingConceptUuid: string;
    ironReceivingConceptUuid: string;
    nutritionCounselingConceptUuid: string;
  };
  earlyStimulation: {
    developmentEvalConceptUuid: string;
    tepsiCoordinationConceptUuid: string;
    tepsiMotorConceptUuid: string;
    stimulationLackConceptUuid: string;
    counselingConceptUuid: string;
  };
}
