import { Type } from '@openmrs/esm-framework';

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
      healthyChildControl: 'a990eabc-3405-419f-bfb1-96ca2d8279b8', // Control de Niño Sano — NTS 102
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
      familyPlanning: 'c8a42de8-caa7-42da-9a76-20bbd388db16',
      cervicalCancerScreening: '56ac61e7-2629-4834-b2b0-6831bc20f50f',
      breastCancerScreening: '2f2a0a11-6ec9-4d01-96bd-11c3188d4a9d',
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
    _description: 'List of form UUIDs',
    _default: {
      // Maternal Forms
      prenatal: 'e8f98494-af35-4bb8-9fc7-c409c8fed843',
      postNatal: '72aa78e0-ee4b-47c3-9073-26f3b9ecc4a7',
      maternalHistory: 'OBST-001-ANTECEDENTES',
      deliveryOrAbortion: 'OBST-005-PARTO O ABORTO',
      SummaryOfLaborAndPostpartum: 'HOSP-007-RESUMEN DE PARTO-POSTPARTO',
      currentPregnancy: 'OBST-002-EMBARAZO ACTUAL',
      prenatalCare: 'OBST-002-EMBARAZO ACTUAL',
      immediatePostpartumPeriod: 'OBST-006-PUERPERIO INMEDIATO',
      postpartumControl: 'OBST-009-CONTROL DE PUERPERIO',
      labourAndDelivery: '496c7cc3-0eea-4e84-a04c-2292949e2f7f',

      atencionPrenatal: 'OBST-003-ATENCIÓN PRENATAL',
      prenatalSupplementationForm: 'OBST-011-SUPLEMENTACIÓN GESTANTE',
      psychoprophylaxisForm: 'OBST-012-PSICOPROFILAXIS',
      maternalDischargeForm: 'OBST-007-EGRESO MATERNO',
      maternalReadmissionForm: 'OBST-008-REINGRESO MATERNO',
      obstetricsServiceForm: 'OBST-010-SERVICIO DE OBSTETRICIA',
      adolescentPregnancyCareForm: 'OBST-016-ATENCIÓN DIFERENCIADA GESTANTE ADOLESCENTE',
      obstetricReferralForm: 'OBST-017-REFERENCIA CONTRARREFERENCIA OBSTÉTRICA',
      culturalBirthPreferencesForm: 'OBST-018-PERTINENCIA CULTURAL Y PREFERENCIA DE PARTO',

      // CRED Forms
      atencionImmediataNewborn: '(Página 5) ATENCIÓN INMEDIATA DEL RECIÉN NACIDO',
      breastfeedingObservation:
        '(Página 8) Ficha de Observación del Amamantamiento de la Consejería en Lactancia Materna',
      newbornNeuroEval: '(Página 6) EVALUACIÓN CÉFALO-CAUDAL Y NEUROLÓGICO DEL RECIÉN NACIDO',
      roomingIn: '(Página 10) Alojamiento Conjunto',
      birthDetails: '(CRED) Detalles de Nacimiento',
      pregnancyDetails: '(CRED) Embarazo y Parto',

      // EEDP Forms
      eedp2Months: 'Página (30, 31, 32 y 33) EEDP (2 meses)',
      eedp5Months: 'Página (30, 31, 32 y 33) EEDP (5 meses)',
      eedp8Months: 'Página (30, 31, 32 y 33) EEDP (8 meses)',
      eedp12Months: 'Página (30, 31, 32 y 33) EEDP (12 meses)',
      eedp15Months: 'Página (30, 31, 32 y 33) EEDP (15 meses)',
      eedp18Months: 'Página (30, 31, 32 y 33) EEDP (18 meses)',
      eedp21Months: 'Página (30, 31, 32 y 33) EEDP (21 meses)',
      tepsi: '(Página 34, 35 y 36) TEPSI',

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
      clinicalEncounterFormUuid: 'e958f902-64df-4819-afd4-7fb061f59308',

      // HIV/HTS Forms
      defaulterTracingFormUuid: 'a1a62d1e-2def-11e9-b210-d663bd873d93',
      htsScreening: '04295648-7606-11e8-adc0-fa7ae01bbebc',
      htsInitialTest: '402dc5d7-46da-42d4-b2be-f43ea4ad87b0',
      htsRetest: 'b08471f6-0892-4bf7-ab2b-bf79797b8ea4',

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
      adverseReactionForm: 'INMU-002-REPORTE ESAVI',

      // Salud materna, planificación familiar y prevención de cáncer
      perinatalMentalHealthForm: 'OBST-014-SALUD MENTAL PERINATAL',
      maternalViolenceScreeningForm: 'OBST-015-TAMIZAJE VIOLENCIA GESTANTE',
      familyPlanningCounselingForm: 'PF-001-CONSEJERÍA Y MÉTODO ANTICONCEPTIVO',
      familyPlanningFollowupForm: 'PF-002-SEGUIMIENTO PLANIFICACIÓN FAMILIAR',
      cervicalCancerScreeningForm: 'CANCER-001-TAMIZAJE CERVICAL',
      breastCancerScreeningForm: 'CANCER-002-TAMIZAJE MAMA',
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
    // TODO: verify distinct concept UUIDs for each field — currently all three share the same UUID (copy-paste error)
    consultationTime: {
      _type: Type.ConceptUuid,
      _description: 'Hora de consulta CRED',
      _default: 'a855816a-8bc2-43c8-9cf7-80090dabc47d', // TODO: verify distinct concept UUID
    },
    controlNumber: {
      _type: Type.ConceptUuid,
      _description: 'Número de control CRED',
      _default: 'a855816a-8bc2-43c8-9cf7-80090dabc47d', // TODO: verify distinct concept UUID
    },
    attendedAge: {
      _type: Type.ConceptUuid,
      _description: 'Edad atendida en el control CRED',
      _default: 'a855816a-8bc2-43c8-9cf7-80090dabc47d', // TODO: verify distinct concept UUID
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
      _description: 'Concept set para el seguimiento del niño sano',
      _default: '', // TODO: set real concept set UUID from OCL
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
      _default: '5da8b9b1-f566-411f-b50b-f634ed6321c0',
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

  // 10A. TAMIZAJE DE ANEMIA (NTS 137)
  anemiaScreening: {
    _type: Type.Object,
    _description: 'Configuración del tamizaje de anemia según NTS 137',
    _default: {
      hemoglobinaConceptUuid: '0ffe780c-a3ee-4c9c-b4dd-bf2e0f79dc7f',
      anemiaThreshold: 11.0,
    },
    hemoglobinaConceptUuid: {
      _type: Type.ConceptUuid,
      _description: 'Concept UUID para valor de hemoglobina (g/dL) — OCL: Hemoglobina #655',
      _default: '0ffe780c-a3ee-4c9c-b4dd-bf2e0f79dc7f',
    },
    anemiaThreshold: {
      _type: Type.Number,
      _description: 'Umbral para considerar anemia (g/dL). NTS 137: < 11.0',
      _default: 11.0,
    },
  },

  // 10B. SUPLEMENTACIÓN (Directiva 068 niño / Directiva 069 gestante)
  supplementation: {
    _type: Type.Object,
    _description: 'Configuración de suplementación MMN y prenatal',
    _default: {
      mmnConceptUuid: 'd80c3551-2a6c-49ac-a541-0b17957f9657',
      mmnTotalTarget: 360,
      ironConceptUuid: '03a4f101-bf46-4923-97a1-759d926dee00',
      folicAcidConceptUuid: '7418c3a3-4c2a-4943-91db-ae2b561d6ded',
      calciumConceptUuid: '15df7b2b-ad43-410e-9edb-d1f40320faf4',
    },
    mmnConceptUuid: {
      _type: Type.ConceptUuid,
      _description: 'Concept UUID de multimicronutrientes entregados — OCL: Administración Micronutriente #3162',
      _default: 'd80c3551-2a6c-49ac-a541-0b17957f9657',
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
      conceptUuid: '400ebbfe-bdb6-42b8-a783-226e027e2e05',
      totalSessionsRequired: 6,
    },
    encounterTypeUuid: {
      _type: Type.UUID,
      _description: 'Encounter type UUID para sesiones de psicoprofilaxis — Sesión de Psicoprofilaxis (RM 361-2011)',
      _default: '3cde4d44-72f8-4aeb-9025-7a8906a56ae8',
    },
    conceptUuid: {
      _type: Type.ConceptUuid,
      _description: 'Concept UUID de psicoprofilaxis obstétrica — OCL: Psicoprofilaxis #1598',
      _default: '400ebbfe-bdb6-42b8-a783-226e027e2e05',
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
      highRiskConceptUuid: '735bfdaa-7005-4dae-90c8-0b45d3f71208',
      lowRiskConceptUuid: '7be08cd5-d237-445b-b218-42450cfb4874',
      veryHighRiskConceptUuid: 'f01af67b-322c-4067-b77f-fe0c92148ed1',
      riskFactorsConceptUuid: '601c996b-1edb-4406-948a-2ba4cc26789a',
    },
    classificationConceptUuid: {
      _type: Type.ConceptUuid,
      _description: 'Concept UUID de Grupo de Riesgo — OCL: Grupo de Riesgo #1530 (Coded)',
      _default: '6b38e548-6cbb-456a-ae5d-51eecba16651',
    },
    highRiskConceptUuid: {
      _type: Type.ConceptUuid,
      _description: 'Concept UUID para "Riesgo Sanitario Alto" — OCL: #3622',
      _default: '735bfdaa-7005-4dae-90c8-0b45d3f71208',
    },
    lowRiskConceptUuid: {
      _type: Type.ConceptUuid,
      _description: 'Concept UUID para "Riesgo Sanitario Mínimo" — OCL: #3620',
      _default: '7be08cd5-d237-445b-b218-42450cfb4874',
    },
    veryHighRiskConceptUuid: {
      _type: Type.ConceptUuid,
      _description: 'Concept UUID para "Riesgo Sanitario Muy Alto" — OCL: #3623',
      _default: 'f01af67b-322c-4067-b77f-fe0c92148ed1',
    },
    riskFactorsConceptUuid: {
      _type: Type.ConceptUuid,
      _description:
        'Concept UUID de factores de riesgo obstétrico (23 answers) — OCL: Motivo derivación casa espera #378 (Coded)',
      _default: '601c996b-1edb-4406-948a-2ba4cc26789a',
    },
  },

  // 10G. NUTRICIÓN INFANTIL (NTS 137)
  childNutrition: {
    _type: Type.Object,
    _description: 'Concepts para evaluación y seguimiento nutricional infantil',
    _default: {
      weightForAgeConceptUuid: '44ca0b9e-d453-473d-80fc-cc5c6c97c4e1',
      heightForAgeConceptUuid: 'f0a86915-09a2-4e1f-a9a3-bb870cea6b80',
      weightForHeightConceptUuid: '58c5581a-cc71-473e-b3a6-cd1c393b7d54',
      heightPercentileConceptUuid: 'd37c8f1a-4a7d-4066-835f-253c80ad3fc7',
      feedingAssessmentConceptUuid: '6d411bf5-4391-4f4b-8ec6-7f789be9a237',
      breastfeedingConceptUuid: '0c1098a3-d445-4968-9f68-6b687500246e',
      mmnReceivingConceptUuid: '5ab754bf-9332-4f4a-abac-c0a00f398381',
      ironReceivingConceptUuid: 'e336f84a-5593-47f9-af88-2d8f2c79bfc2',
      nutritionCounselingCountConceptUuid: '8231f0af-cbd8-4b93-9708-d88175b81325',
    },
    weightForAgeConceptUuid: {
      _type: Type.ConceptUuid,
      _description: 'Concept UUID de Peso/Edad (P/E) — OCL: Peso Edad #3171',
      _default: '44ca0b9e-d453-473d-80fc-cc5c6c97c4e1',
    },
    heightForAgeConceptUuid: {
      _type: Type.ConceptUuid,
      _description: 'Concept UUID de Talla/Edad (T/E) — OCL: Talla Edad #3172',
      _default: 'f0a86915-09a2-4e1f-a9a3-bb870cea6b80',
    },
    weightForHeightConceptUuid: {
      _type: Type.ConceptUuid,
      _description: 'Concept UUID de Peso/Talla (P/T) — OCL: Peso Talla #3173',
      _default: '58c5581a-cc71-473e-b3a6-cd1c393b7d54',
    },
    heightPercentileConceptUuid: {
      _type: Type.ConceptUuid,
      _description: 'Concept UUID de Percentilo de talla — OCL: #1223 (Numeric)',
      _default: 'd37c8f1a-4a7d-4066-835f-253c80ad3fc7',
    },
    feedingAssessmentConceptUuid: {
      _type: Type.ConceptUuid,
      _description: 'Concept UUID de evaluación de alimentación del niño — OCL: #2279 (Coded, 17 Q-AND-A)',
      _default: '6d411bf5-4391-4f4b-8ec6-7f789be9a237',
    },
    breastfeedingConceptUuid: {
      _type: Type.ConceptUuid,
      _description: 'Concept UUID de ¿Recibe lactancia materna? — OCL: #1815 (Coded)',
      _default: '0c1098a3-d445-4968-9f68-6b687500246e',
    },
    mmnReceivingConceptUuid: {
      _type: Type.ConceptUuid,
      _description: 'Concept UUID de ¿Recibiendo MMN? — OCL: #1812 (Coded)',
      _default: '5ab754bf-9332-4f4a-abac-c0a00f398381',
    },
    ironReceivingConceptUuid: {
      _type: Type.ConceptUuid,
      _description: 'Concept UUID de ¿Tomando suplemento de hierro? — OCL: #1808 (Coded)',
      _default: 'e336f84a-5593-47f9-af88-2d8f2c79bfc2',
    },
    nutritionCounselingCountConceptUuid: {
      _type: Type.ConceptUuid,
      _description: 'Concept UUID de número de consejería nutricional — OCL: #4194 (Numeric)',
      _default: '8231f0af-cbd8-4b93-9708-d88175b81325',
    },
  },

  // 10H. ESTIMULACIÓN TEMPRANA (NTS 137)
  earlyStimulation: {
    _type: Type.Object,
    _description: 'Concepts para estimulación temprana y seguimiento del desarrollo',
    _default: {
      developmentEvalConceptUuid: 'eb31eed5-5070-4d59-90b0-eb1d0e810d31',
      tepsiCoordinationConceptUuid: 'ecc332d2-6ca1-4238-ac14-d0de521bdb11',
      tepsiMotorConceptUuid: '7aec4f14-e2fb-4489-bcc5-50c7bf609a5b',
      stimulationLackConceptUuid: '861b53cc-e5ea-433c-9417-a8d4a6aeda26',
      counselingConceptUuid: 'de5570f2-70f4-42ee-97c1-def5ca8333df',
    },
    developmentEvalConceptUuid: {
      _type: Type.ConceptUuid,
      _description: 'Concept UUID de evaluación de desarrollo — OCL: Evaluación de Desarrollo #3648',
      _default: 'eb31eed5-5070-4d59-90b0-eb1d0e810d31',
    },
    tepsiCoordinationConceptUuid: {
      _type: Type.ConceptUuid,
      _description: 'Concept UUID de subtests coordinación TEPSI — OCL: #2195 (Coded)',
      _default: 'ecc332d2-6ca1-4238-ac14-d0de521bdb11',
    },
    tepsiMotorConceptUuid: {
      _type: Type.ConceptUuid,
      _description: 'Concept UUID de subtests motricidad TEPSI — OCL: #2196 (Coded)',
      _default: '7aec4f14-e2fb-4489-bcc5-50c7bf609a5b',
    },
    stimulationLackConceptUuid: {
      _type: Type.ConceptUuid,
      _description: 'Concept UUID de falta de estimulación del desarrollo — OCL: #1991 (Coded)',
      _default: '861b53cc-e5ea-433c-9417-a8d4a6aeda26',
    },
    counselingConceptUuid: {
      _type: Type.ConceptUuid,
      _description: 'Concept UUID de orientación y consejería — OCL: #2032 (Coded)',
      _default: 'de5570f2-70f4-42ee-97c1-def5ca8333df',
    },
  },

  // 10. AGE GROUPS CONFIGURATION
  ageGroupsCRED: {
    _type: Type.Array,
    _description: 'Configuración de grupos etarios para CRED',
    _default: [
      { label: 'RN - 48h', sublabel: 'CONTROL 1 (2 DÍAS)', minDays: 0, maxDays: 3, neonatalControl: 1 },
      { label: 'RN - 7d', sublabel: 'CONTROL 2 (7 DÍAS)', minDays: 4, maxDays: 10, neonatalControl: 2 },
      { label: 'RN - 14d', sublabel: 'CONTROL 3 (14 DÍAS)', minDays: 11, maxDays: 17, neonatalControl: 3 },
      { label: 'RN - 21d', sublabel: 'CONTROL 4 (21 DÍAS)', minDays: 18, maxDays: 29, neonatalControl: 4 },
      { label: '0 AÑOS', sublabel: '1 A 11 MESES', minMonths: 1, maxMonths: 11 },
      { label: '1 AÑO', sublabel: '12 A 23 MESES', minMonths: 12, maxMonths: 23 },
      { label: '2 AÑOS', sublabel: '24 A 35 MESES', minMonths: 24, maxMonths: 35 },
      { label: '3 AÑOS', sublabel: '36 A 47 MESES', minMonths: 36, maxMonths: 47 },
      { label: '4 AÑOS', sublabel: '48 A 59 MESES', minMonths: 48, maxMonths: 59 },
      { label: '5 AÑOS', minMonths: 60, maxMonths: 71 },
      { label: '6 AÑOS', minMonths: 72, maxMonths: 83 },
      { label: '7 AÑOS', minMonths: 84, maxMonths: 95 },
      { label: '8 AÑOS', minMonths: 96, maxMonths: 107 },
      { label: '9 AÑOS', minMonths: 108, maxMonths: 119 },
      { label: '10 AÑOS', minMonths: 120, maxMonths: 131 },
      { label: '11 AÑOS', minMonths: 132, maxMonths: 143 },
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
      _default: '', // TODO: set real legend concept set UUID
    },
  },

  // 16. PARTOGRAPHY CONFIGURATION
  partography: {
    _type: Type.Object,
    _description:
      'Configuración de partograma: encounter, formulario y conceptos usados para mostrar evolución del parto',
    _default: {
      encounterTypeUuid: '8993b43c-7878-4e80-9257-1da45e84a904',
      formUuid: 'HOSP-011-HOJA DE MONITORIZACIÓN OBSTÉTRICA-PARTO',
      progressConceptUuid: '44426693-0529-4e37-8efe-8ec5b2cbb290',
      concepts: {
        timeRecordedUuid: '2c67cd3d-407c-4f4d-bdf7-0f32b42ccfb4',
        fetalHeartRateUuid: 'b1fb2d14-92ec-4fda-90e5-40f3227c9c65',
        cervicalDilationUuid: '',
        descentOfHeadUuid: '',
        contractionFrequencyUuid: '20eb9478-2ab2-48bd-8dca-3b563b0c7c47',
        contractionIntensityUuid: 'ba6099d8-f7ce-41de-b9ec-6e8b42252911',
        contractionDurationUuid: '9641ed77-354a-4a10-b16e-85b8f934031d',
        maternalSystolicBloodPressureUuid: '5085AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        maternalDiastolicBloodPressureUuid: '5086AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        maternalPulseUuid: '5087AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        maternalTemperatureUuid: '5088AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        maternalRespiratoryRateUuid: '5242AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        urineOutputUuid: 'e204d05c-f4f2-4935-88a2-c6ebcded999f',
        fetalDeathUuid: '9e77be6d-6659-4cf3-bb27-8956ce6dcb67',
        observationsUuid: 'f947a4ad-3d8d-4516-8e6b-67b3dca4e227',
      },
      descentOfHeadAnswerLabels: {
        '162135AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA': '1/5',
        '166065AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA': '2/5',
        '166066AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA': '3/5',
        '166067AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA': '4/5',
        '163734AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA': '5/5',
      },
    },
    encounterTypeUuid: {
      _type: Type.UUID,
      _description: 'Encounter type UUID usado para recuperar datos seriados del partograma/monitorización obstétrica',
      _default: '8993b43c-7878-4e80-9257-1da45e84a904',
    },
    formUuid: {
      _type: Type.String,
      _description: 'Identificador, UUID o nombre del formulario usado al abrir y filtrar el registro del partograma',
      _default: 'HOSP-011-HOJA DE MONITORIZACIÓN OBSTÉTRICA-PARTO',
    },
    progressConceptUuid: {
      _type: Type.ConceptUuid,
      _description: 'Concept UUID del grupo de observaciones de progreso del partograma',
      _default: '44426693-0529-4e37-8efe-8ec5b2cbb290',
    },
    concepts: {
      _type: Type.Object,
      _description: 'Conceptos clínicos que componen una fila del partograma',
      _default: {
        timeRecordedUuid: '2c67cd3d-407c-4f4d-bdf7-0f32b42ccfb4',
        fetalHeartRateUuid: 'b1fb2d14-92ec-4fda-90e5-40f3227c9c65',
        cervicalDilationUuid: '',
        descentOfHeadUuid: '',
        contractionFrequencyUuid: '20eb9478-2ab2-48bd-8dca-3b563b0c7c47',
        contractionIntensityUuid: 'ba6099d8-f7ce-41de-b9ec-6e8b42252911',
        contractionDurationUuid: '9641ed77-354a-4a10-b16e-85b8f934031d',
        maternalSystolicBloodPressureUuid: '5085AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        maternalDiastolicBloodPressureUuid: '5086AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        maternalPulseUuid: '5087AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        maternalTemperatureUuid: '5088AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        maternalRespiratoryRateUuid: '5242AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        urineOutputUuid: 'e204d05c-f4f2-4935-88a2-c6ebcded999f',
        fetalDeathUuid: '9e77be6d-6659-4cf3-bb27-8956ce6dcb67',
        observationsUuid: 'f947a4ad-3d8d-4516-8e6b-67b3dca4e227',
      },
    },
    descentOfHeadAnswerLabels: {
      _type: Type.Object,
      _description: 'Mapa configurable de respuestas de descenso de cabeza a etiquetas clínicas',
      _default: {
        '162135AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA': '1/5',
        '166065AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA': '2/5',
        '166066AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA': '3/5',
        '166067AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA': '4/5',
        '163734AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA': '5/5',
      },
    },
  },

  // 17. CRED FORMS BY AGE GROUP CONFIGURATION
  CREDFormsByAgeGroup: {
    _type: Type.Array,
    _description: 'Configuración de formularios CRED por grupo etario',
    _default: [
      {
        label: 'RN - 48h (Control 1)',
        minDays: 0,
        maxDays: 3,
        neonatalControl: 1,
        forms: ['atencionImmediataNewborn', 'newbornNeuroEval', 'breastfeedingObservation', 'roomingIn'],
      },
      {
        label: 'RN - 7d (Control 2)',
        minDays: 4,
        maxDays: 10,
        neonatalControl: 2,
        forms: ['nursingAssessment', 'breastfeedingObservation'],
      },
      {
        label: 'RN - 14d (Control 3)',
        minDays: 11,
        maxDays: 17,
        neonatalControl: 3,
        forms: ['nursingAssessment', 'breastfeedingObservation'],
      },
      {
        label: 'RN - 21d (Control 4)',
        minDays: 18,
        maxDays: 29,
        neonatalControl: 4,
        forms: ['nursingAssessment', 'breastfeedingObservation'],
      },
      {
        label: '2 MESES',
        minMonths: 1,
        maxMonths: 2.5,
        forms: ['eedp2Months', 'nursingAssessment', 'childFeeding0to5', 'riskInterview0to30'],
      },
      {
        label: '4 MESES',
        minMonths: 2.5,
        maxMonths: 5,
        forms: ['eedp5Months', 'nursingAssessment', 'childFeeding0to5', 'riskInterview0to30'],
      },
      {
        label: '6 MESES',
        minMonths: 5,
        maxMonths: 8,
        forms: ['eedp5Months', 'nursingAssessment', 'childFeeding6to42', 'riskInterview0to30'],
      },
      {
        label: '9 MESES',
        minMonths: 8,
        maxMonths: 11,
        forms: ['eedp8Months', 'nursingAssessment', 'childFeeding6to42', 'riskInterview0to30'],
      },
      {
        label: '12 MESES',
        minMonths: 11,
        maxMonths: 15,
        forms: ['eedp12Months', 'nursingAssessment', 'childFeeding6to42', 'riskInterview0to30', 'childAbuseScreening'],
      },
      {
        label: '15 MESES',
        minMonths: 15,
        maxMonths: 18,
        forms: ['eedp15Months', 'nursingAssessment', 'childFeeding6to42', 'childAbuseScreening'],
      },
      {
        label: '18 MESES',
        minMonths: 18,
        maxMonths: 24,
        forms: ['eedp18Months', 'nursingAssessment', 'childFeeding6to42', 'childAbuseScreening'],
      },
      {
        label: '2 AÑOS',
        minMonths: 24,
        maxMonths: 30,
        forms: ['eedp21Months', 'nursingAssessment', 'childFeeding6to42', 'childAbuseScreening'],
      },
      {
        label: '30 MESES',
        minMonths: 30,
        maxMonths: 36,
        forms: ['tepsi', 'nursingAssessment', 'childFeeding6to42', 'childAbuseScreening'],
      },
      {
        label: '3 AÑOS',
        minMonths: 36,
        maxMonths: 48,
        forms: ['tepsi', 'nursingAssessment', 'childAbuseScreening'],
      },
      {
        label: '4 AÑOS',
        minMonths: 48,
        maxMonths: 60,
        forms: ['tepsi', 'nursingAssessment', 'childAbuseScreening'],
      },
      {
        label: '5 AÑOS',
        minMonths: 60,
        maxMonths: 120,
        forms: ['tepsi', 'nursingAssessment', 'childAbuseScreening'],
      },
    ],
    _elements: {
      _type: Type.Object,
      label: { _type: Type.String },
      minMonths: { _type: Type.Number },
      maxMonths: { _type: Type.Number },
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
  concepts: {
    obsDateUiid?: string;
    obsDateUuid?: string;
    timeRecordedUuid: string;
    fetalHeartRateUuid: string;
    cervicalDilationUiid?: string;
    cervicalDilationUuid: string;
    descentOfHead?: string;
    descentOfHeadUuid: string;
    contractionFrequencyUuid: string;
    contractionIntensityUuid?: string;
    contractionDurationUuid: string;
    maternalSystolicBloodPressureUuid?: string;
    maternalDiastolicBloodPressureUuid?: string;
    maternalPulseUuid?: string;
    maternalTemperatureUuid?: string;
    maternalRespiratoryRateUuid?: string;
    urineOutputUuid?: string;
    fetalDeathUuid?: string;
    observationsUuid?: string;
  };
  descentOfHeadAnswerLabels: Record<string, string>;
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
    familyPlanning: string;
    cervicalCancerScreening: string;
    breastCancerScreening: string;
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
    postnatal: string;
    labourAndDelivery: string;
    atencionPrenatal: string;
    prenatalSupplementationForm: string;
    psychoprophylaxisForm: string;
    maternalDischargeForm: string;
    maternalReadmissionForm: string;
    obstetricsServiceForm: string;
    adolescentPregnancyCareForm: string;
    obstetricReferralForm: string;
    culturalBirthPreferencesForm: string;
    atencionImmediataNewborn: string;
    maternalHistory: string;
    deliveryOrAbortion: string;
    SummaryOfLaborAndPostpartum: string;
    currentPregnancy: string;
    prenatalCare: string;
    immediatePostpartumPeriod: string;
    postpartumControl: string;
    defaulterTracingFormUuid: string;
    htsScreening: string;
    htsInitialTest: string;
    htsRetest: string;
    clinicalEncounterFormUuid: string;
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
    adverseReactionForm: string;
    perinatalMentalHealthForm: string;
    maternalViolenceScreeningForm: string;
    familyPlanningCounselingForm: string;
    familyPlanningFollowupForm: string;
    cervicalCancerScreeningForm: string;
    breastCancerScreeningForm: string;
  };
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
    anemiaThreshold: number;
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
    weightForAgeConceptUuid: string;
    heightForAgeConceptUuid: string;
    weightForHeightConceptUuid: string;
    heightPercentileConceptUuid: string;
    feedingAssessmentConceptUuid: string;
    breastfeedingConceptUuid: string;
    mmnReceivingConceptUuid: string;
    ironReceivingConceptUuid: string;
    nutritionCounselingCountConceptUuid: string;
  };
  earlyStimulation: {
    developmentEvalConceptUuid: string;
    tepsiCoordinationConceptUuid: string;
    tepsiMotorConceptUuid: string;
    stimulationLackConceptUuid: string;
    counselingConceptUuid: string;
  };
}
