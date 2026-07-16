import { Type, validators } from '@openmrs/esm-framework';

/**
 * Configuration schema for the Emergency module.
 *
 * In OpenMRS Microfrontends, all config parameters are optional. Thus,
 * all elements must have a reasonable default. A good default is one
 * that works well with the reference application.
 *
 * To understand the schema below, please read the configuration system
 * documentation:
 *   https://openmrs.github.io/openmrs-esm-core/#/main/config
 * Note especially the section "How do I make my module configurable?"
 *   https://openmrs.github.io/openmrs-esm-core/#/main/config?id=im-developing-an-esm-module-how-do-i-make-it-configurable
 * and the Schema Reference
 *   https://openmrs.github.io/openmrs-esm-core/#/main/config?id=schema-reference
 */

const priorityTagColors = [
  'red',
  'orange',
  'yellow',
  'magenta',
  'purple',
  'blue',
  'cyan',
  'teal',
  'green',
  'gray',
  'cool-gray',
  'warm-gray',
  'high-contrast',
  'outline',
] as const;
type PriorityTagColor = (typeof priorityTagColors)[number];

const tagStyles = ['bold'] as const;
type TagStyle = (typeof tagStyles)[number];

export const configSchema = {
  /**
   * UUID de la cola de triaje de emergencias (pre-triaje)
   * Pacientes recién registrados entran aquí con clasificación emergencia/urgencia
   */
  emergencyTriageQueueUuid: {
    _type: Type.UUID,
    _default: 'b1c5bb01-d78f-4f7e-b66d-b8bfe6887cf0',
    _description: 'UUID de la cola de triaje de emergencias (pre-triaje: emergencia/urgencia)',
  },

  /**
   * UUID de la cola de atención de emergencias (post-triaje)
   * Pacientes triados con prioridad I-IV pasan a esta cola para atención médica
   */
  emergencyAttentionQueueUuid: {
    _type: Type.UUID,
    _default: 'ebd44a3d-9ecd-47a0-aa49-1279386b3ffe',
    _description: 'UUID de la cola de atención de emergencias (post-triaje: prioridades I-IV)',
  },

  /**
   * UUID del servicio de emergencias (Triage service)
   * Este servicio se usa para gestionar el flujo de pacientes en emergencias
   */
  emergencyServiceUuid: {
    _type: Type.UUID,
    _default: 'd62d58e9-ec91-4108-9643-00f5f23bf51c',
    _description: 'UUID del servicio de triage/emergencias',
  },

  /**
   * UUID de la ubicación principal de emergencias
   * Por ejemplo: Outpatient Clinic (fallback)
   */
  emergencyLocationUuid: {
    _type: Type.UUID,
    _default: '35d2234e-129a-4c40-abb2-1ae0b2400003',
    _description: 'UUID de la ubicación principal del servicio de emergencias (UPSS - EMERGENCIA)',
  },

  /**
   * UUID de la ubicación UPSS - EMERGENCIA
   * Ubicación específica para la unidad productora de servicios de salud de emergencias
   */
  upssEmergencyLocationUuid: {
    _type: Type.UUID,
    _default: '35d2234e-129a-4c40-abb2-1ae0b2400003',
    _description: 'UUID de la ubicación UPSS - EMERGENCIA',
  },

  /**
   * UUIDs de los estados de la cola de emergencias
   * Define los estados permitidos para el flujo de atención
   */
  queueStatuses: {
    waitingUuid: {
      _type: Type.UUID,
      _default: '51ae5e4d-b72b-4912-bf31-a17efb690aeb',
      _description: 'UUID del estado "En espera"',
    },
    inServiceUuid: {
      _type: Type.UUID,
      _default: '9d7c8a4b-2c08-4f54-b2dd-5c5fd325029c',
      _description: 'UUID del estado "Atendiéndose / En servicio"',
    },
    finishedServiceUuid: {
      _type: Type.UUID,
      _default: '707b1d1e-d7f7-4dad-a382-3734e35933c3',
      _description: 'UUID del estado "Servicio finalizado"',
    },
  },
  /**
   * Configuración de prioridades según Norma Técnica Peruana
   * Cada prioridad debe mapearse a un concepto UUID existente en OpenMRS.
   *
   * IMPORTANTE: Los UUIDs deben ser configurados en los archivos de configuración
   * del backend (config-pucp.json o config-openmrs.json) después de crear los
   * conceptos correspondientes en OpenMRS.
   */
  priorityConfigs: {
    _type: Type.Array,
    _default: [
      {
        code: 'PRIORITY_I',
        conceptUuid: '9b4acfe0-735f-4701-b1c8-4fbf4a66bb7e',
        label: 'Prioridad I',
        description: 'Gravedad súbita extrema',
        color: 'red',
        style: 'bold',
        sortWeight: 1,
        maxWaitTimeMinutes: 0,
      },
      {
        code: 'PRIORITY_II',
        conceptUuid: '1606e719-d480-40c9-b586-835458ad0a96',
        label: 'Prioridad II',
        description: 'Urgencia mayor',
        color: 'orange',
        style: null,
        sortWeight: 2,
        maxWaitTimeMinutes: 10,
      },
      {
        code: 'PRIORITY_III',
        conceptUuid: 'ef342bd8-6dd2-4abe-ac29-9eff842dcb8d',
        label: 'Prioridad III',
        description: 'Urgencia menor',
        color: 'yellow',
        style: null,
        sortWeight: 3,
        maxWaitTimeMinutes: 60,
      },
      {
        code: 'PRIORITY_IV',
        conceptUuid: '427a595a-a5ee-4ba7-bcb7-2503248efb31',
        label: 'Prioridad IV',
        description: 'Patología aguda común',
        color: 'green',
        style: null,
        sortWeight: 4,
        maxWaitTimeMinutes: 120,
      },
    ],
    _description: 'Configuración de prioridades de emergencia según norma técnica peruana',
    _elements: {
      code: {
        _type: Type.String,
        _description: 'Código de la prioridad (ej: PRIORITY_I, PRIORITY_II)',
      },
      conceptUuid: {
        _type: Type.ConceptUuid,
        _description: 'UUID del concepto de prioridad en OpenMRS',
      },
      label: {
        _type: Type.String,
        _description: 'Etiqueta de visualización de la prioridad',
      },
      description: {
        _type: Type.String,
        _description: 'Descripción de la prioridad',
      },
      color: {
        _type: Type.String,
        _default: 'gray',
        _description: 'Color del tag de prioridad (red, orange, green, etc.)',
        _validators: [validators.oneOf(priorityTagColors)],
      },
      style: {
        _type: Type.String,
        _default: null,
        _description: 'Estilo del tag (bold para Prioridad I)',
        _validators: [validators.oneOf(tagStyles)],
      },
      sortWeight: {
        _type: Type.Number,
        _default: 1,
        _description: 'Peso de ordenamiento (menor = mayor prioridad)',
      },
      maxWaitTimeMinutes: {
        _type: Type.Number,
        _default: 0,
        _description: 'Tiempo máximo de espera en minutos según norma técnica',
      },
    },
  },

  /**
   * Concepto UUID por defecto para cada nivel de prioridad
   * Estos UUIDs deben ser configurados después de crear los conceptos en OpenMRS
   */
  concepts: {
    priorityIConceptUuid: {
      _type: Type.ConceptUuid,
      _default: '9b4acfe0-735f-4701-b1c8-4fbf4a66bb7e',
      _description: 'UUID del concepto para Prioridad I - Gravedad súbita extrema (Emergencia Inmediata)',
    },
    priorityIIConceptUuid: {
      _type: Type.ConceptUuid,
      _default: '1606e719-d480-40c9-b586-835458ad0a96',
      _description: 'UUID del concepto para Prioridad II - Urgencia mayor (Emergencia Urgente)',
    },
    priorityIIIConceptUuid: {
      _type: Type.ConceptUuid,
      _default: 'ef342bd8-6dd2-4abe-ac29-9eff842dcb8d',
      _description: 'UUID del concepto para Prioridad III - Urgencia menor (Urgencia Médica)',
    },
    priorityIVConceptUuid: {
      _type: Type.ConceptUuid,
      _default: '427a595a-a5ee-4ba7-bcb7-2503248efb31',
      _description: 'UUID del concepto para Prioridad IV - Patología aguda común (Urgencia Menor)',
    },
    /**
     * Conceptos de clasificación inicial (pre-triaje).
     * Estos son SEPARADOS de las prioridades I-IV (post-triaje).
     */
    emergencyConceptUuid: {
      _type: Type.ConceptUuid,
      _default: 'b0cdc710-4850-4ff6-a07f-8a1130aefdd9',
      _description: 'UUID del concepto "Emergencia (Pre-triaje)" para clasificación inicial.',
    },
    urgencyConceptUuid: {
      _type: Type.ConceptUuid,
      _default: '0f0baaea-9613-45c3-8a39-c2f5e14f4bbf',
      _description: 'UUID del concepto "Urgencia (Pre-triaje)" para clasificación inicial.',
    },
  },

  /**
   * Configuración del encounter de triaje
   * Encounter type y conceptos de signos vitales (CIEL estándar)
   */
  triageEncounter: {
    encounterTypeUuid: {
      _type: Type.UUID,
      _default: '67a71486-1a54-468f-ac3e-7091a9a79584',
      _description: 'UUID del encounter type "Triaje"',
    },
    vitalSignsConcepts: {
      temperatureUuid: {
        _type: Type.ConceptUuid,
        _default: '5088AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        _description: 'UUID del concepto Temperatura (CIEL 5088)',
      },
      heartRateUuid: {
        _type: Type.ConceptUuid,
        _default: '5087AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        _description: 'UUID del concepto Frecuencia cardíaca / Pulso (CIEL 5087)',
      },
      respiratoryRateUuid: {
        _type: Type.ConceptUuid,
        _default: '5242AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        _description: 'UUID del concepto Frecuencia respiratoria (CIEL 5242)',
      },
      systolicBpUuid: {
        _type: Type.ConceptUuid,
        _default: '5085AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        _description: 'UUID del concepto Presión arterial sistólica (CIEL 5085)',
      },
      diastolicBpUuid: {
        _type: Type.ConceptUuid,
        _default: '5086AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        _description: 'UUID del concepto Presión arterial diastólica (CIEL 5086)',
      },
      oxygenSaturationUuid: {
        _type: Type.ConceptUuid,
        _default: '5092AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        _description: 'UUID del concepto Saturación de oxígeno (CIEL 5092)',
      },
      consciousnessLevelUuid: {
        _type: Type.ConceptUuid,
        _default: '2944f99e-bda8-4acc-8a4e-d5709dd82041',
        _description: 'UUID del concepto Conciencia y orientación (tipo Text)',
      },
      weightUuid: {
        _type: Type.ConceptUuid,
        _default: '5089AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        _description: 'UUID del concepto Peso Corporal (CIEL 5089)',
      },
      heightUuid: {
        _type: Type.ConceptUuid,
        _default: '5090AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        _description: 'UUID del concepto Talla (CIEL 5090)',
      },
      anamnesisUuid: {
        _type: Type.ConceptUuid,
        _default: '6d99603e-ae9d-4838-8a09-ba75e27ff1e9',
        _description: 'UUID del concepto Anamnesis (texto libre)',
      },
      illnessDurationUuid: {
        _type: Type.ConceptUuid,
        _default: '577876b1-0b6e-4c57-b4c3-7af969a1d501',
        _description: 'UUID del concepto Tiempo de enfermedad',
      },
      onsetTypeUuid: {
        _type: Type.ConceptUuid,
        _default: '34e03399-cb72-484b-85b8-616ef19919c1',
        _description: 'UUID del concepto Forma de inicio',
      },
      courseUuid: {
        _type: Type.ConceptUuid,
        _default: 'e7d98188-16ba-4ef3-aed9-e891680bacf9',
        _description: 'UUID del concepto Curso',
      },
      clinicalExamUuid: {
        _type: Type.ConceptUuid,
        _default: '830f3546-14fb-4d45-b889-a736b85a039c',
        _description: 'UUID del concepto Examen Clínico (texto libre)',
      },
    },
  },

  /**
   * Configuración del encounter de atención de emergencia
   * Encounter type y conceptos para diagnóstico, tratamiento y exámenes auxiliares
   */
  attentionEncounter: {
    encounterTypeUuid: {
      _type: Type.UUID,
      _default: '1b70fe57-92c1-4e35-87f7-13d0e04ff12f',
      _description: 'UUID del encounter type "Atención en Emergencia"',
    },
    concepts: {
      diagnosisUuid: {
        _type: Type.ConceptUuid,
        _default: '6080231e-f27e-4ee6-93ba-ea2ca0bf2906',
        _description: 'Concepto Diagnóstico (Text)',
      },
      treatmentUuid: {
        _type: Type.ConceptUuid,
        _default: 'b8723c0f-b7e5-4ab2-bda6-dc59616a428e',
        _description: 'Concepto Tratamiento (Text)',
      },
      auxiliaryExamsUuid: {
        _type: Type.ConceptUuid,
        _default: '291971f3-d912-4b7f-946a-9d071c888a9f',
        _description: 'Concepto Exámenes Auxiliares Realizados (Text)',
      },
    },
  },

  /**
   * Intervalo de auto-refresh para la cola de emergencias (en milisegundos)
   */
  autoRefreshInterval: {
    _type: Type.Number,
    _default: 30000, // 30 segundos
    _description: 'Intervalo de auto-refresh en milisegundos para la cola de emergencias',
  },

  /**
   * Tipo de visita para emergencias
   * Este UUID debe coincidir con el tipo de visita "Emergency" o "Emergencia" en OpenMRS
   */
  emergencyVisitTypeUuid: {
    _type: Type.UUID,
    _default: 'c2a1d3e2-4b8f-4326-94d9-7f6c9a1b7c98',
    _description: 'UUID del tipo de visita para emergencias',
  },

  closeVisitOnDisposition: {
    _type: Type.Boolean,
    _default: true,
    _description:
      'Si es true, la visita de emergencia se cierra (stopDatetime) al registrar la atención y finalizar la entrada de cola.',
  },

  /**
   * Auto-crear visita al seleccionar paciente existente
   * Si es true, se creará automáticamente una visita de emergencia al seleccionar un paciente
   */
  autoCreateVisitOnPatientSelect: {
    _type: Type.Boolean,
    _default: true,
    _description: 'Crear automáticamente visita de emergencia al seleccionar un paciente existente',
  },

  /**
   * Preguntar antes de crear visita en nuevo registro
   * Si es true, se mostrará un prompt preguntando si desea crear la visita después del registro
   */
  promptVisitCreationOnNewPatient: {
    _type: Type.Boolean,
    _default: true,
    _description: 'Mostrar prompt para crear visita al registrar un nuevo paciente',
  },

  /**
   * Configuración para registro rápido de pacientes
   */
  patientRegistration: {
    defaultIdentifierTypeUuid: {
      _type: Type.UUID,
      _default: '550e8400-e29b-41d4-a716-446655440001', // DNI - 8 dígitos numéricos
      _description: 'UUID del tipo de documento de identidad por defecto para nuevos pacientes (DNI)',
    },
    foreignCardIdentifierTypeUuid: {
      _type: Type.UUID,
      _default: '550e8400-e29b-41d4-a716-446655440002',
      _description: 'UUID del tipo de documento Carné de Extranjería',
    },
    passportIdentifierTypeUuid: {
      _type: Type.UUID,
      _default: '550e8400-e29b-41d4-a716-446655440003',
      _description: 'UUID del tipo de documento Pasaporte',
    },
    dieIdentifierTypeUuid: {
      _type: Type.UUID,
      _default: '8d793bee-c2cc-11de-8d13-0010c6dffd0f',
      _description: 'UUID del tipo de documento DIE',
    },
    liveBirthCertificateIdentifierTypeUuid: {
      _type: Type.UUID,
      _default: '8d79403a-c2cc-11de-8d13-0010c6dffd0f',
      _description: 'UUID del tipo de documento Certificado de Nacido Vivo',
    },
    otherIdentifierTypeUuid: {
      _type: Type.UUID,
      _default: '',
      _description:
        'UUID opcional del tipo de identificador OTROS. Debe quedar vacío hasta que el tipo exista en el contenido OpenMRS desplegado.',
    },
    otherIdentifierFormat: {
      _type: Type.String,
      _default: '',
      _description:
        'Expresión regular completa, anclada y acotada para OTROS (por ejemplo ^[A-Z0-9]{6,20}$). No admite grupos, alternancias ni cuantificadores sin límite. OTROS solo se ofrece cuando UUID y formato están configurados.',
    },
    otherIdentifierMaxLength: {
      _type: Type.Number,
      _default: 50,
      _description: 'Longitud máxima de OTROS; se aplica solo junto con un UUID y formato aprobados.',
    },
    defaultLocationUuid: {
      _type: Type.UUID,
      _default: '35d2234e-129a-4c40-abb2-1ae0b2400003',
      _description: 'UUID de la ubicación por defecto para registro de pacientes en emergencias (UPSS - EMERGENCIA)',
    },
    phoneNumberAttributeTypeUuid: {
      _type: Type.UUID,
      _default: '14d4f066-15f5-102d-96e4-000c29c2a5d7', // UUID común para atributo de teléfono
      _description: 'UUID del tipo de atributo para número de teléfono',
    },
    identifierSourceUuid: {
      _type: Type.UUID,
      _default: '8549f706-7e85-4c1d-9424-217d50a2988b',
      _description: 'UUID del identifier source (idgen) para auto-generar N° Historia Clínica',
    },
    openMrsIdIdentifierTypeUuid: {
      _type: Type.UUID,
      _default: '05a29f94-c0ed-11e2-94be-8c13b969e334',
      _description: 'UUID del identifier type "N° Historia Clínica"',
    },
    unknownPatientAttributeTypeUuid: {
      _type: Type.UUID,
      _default: '8b56eac7-5c76-4b9c-8c6f-1deab8d3fc47',
      _description: 'UUID del person attribute type para marcar pacientes desconocidos (booleano)',
    },
    nationalityAttributeTypeUuid: {
      _type: Type.UUID,
      _default: '9b3df0a1-0c58-4f55-9868-9c38f1db1007',
      _description: 'UUID del person attribute type País de Nacionalidad (Coded → Concept)',
    },
    nationalityConceptSetUuid: {
      _type: Type.ConceptUuid,
      _default: '7869ef7a-be6c-4108-9ee5-9cc7470e0b2d',
      _description: 'UUID del conjunto de conceptos que contiene las nacionalidades permitidas',
    },
    peruNationalityConceptUuid: {
      _type: Type.ConceptUuid,
      _default: 'e0370dea-d480-4721-a438-97a77d6c3349',
      _description: 'UUID del concepto Perú usado cuando un DNI válido confirma nacionalidad peruana',
    },
    insuranceTypeAttributeTypeUuid: {
      _type: Type.UUID,
      _default: '56188294-b42c-481d-a987-4b495116c580',
      _description: 'UUID del person attribute type Tipo de Seguro de Salud (Coded → Concept)',
    },
    insuranceCodeAttributeTypeUuid: {
      _type: Type.UUID,
      _default: '374b130f-7457-476f-87b1-f182aa77c434',
      _description: 'UUID del person attribute type Código de Seguro (Text)',
    },
    companionNameAttributeTypeUuid: {
      _type: Type.UUID,
      _default: '4697d0e6-5b24-416b-aee6-708cd9a3a1db',
      _description: 'UUID del person attribute type Nombre del Acompañante (Text)',
    },
    companionAgeAttributeTypeUuid: {
      _type: Type.UUID,
      _default: '70ce4571-2e2e-44da-a39f-9dae2a658606',
      _description: 'UUID del person attribute type Edad del Acompañante (Text)',
    },
    companionRelationshipAttributeTypeUuid: {
      _type: Type.UUID,
      _default: 'a180fa5f-c44e-4490-a981-d7196b70c6ac',
      _description: 'UUID del person attribute type Parentesco del Acompañante (Text)',
    },
    responsibleTypeAttributeTypeUuid: {
      _type: Type.UUID,
      _default: '0f2f2f40-c978-491f-8931-8febaafeec84',
      _description:
        'UUID opcional del person attribute type para tipo de responsable (familia, policía, paramédico, institución, etc.).',
    },
    communicationConditionAttributeTypeUuid: {
      _type: Type.UUID,
      _default: 'ee0fb3c8-0432-4035-97c1-e2315d347310',
      _description:
        'UUID opcional del person attribute type para condición de comunicación del paciente al ingreso de emergencia.',
    },
    identificationStatusAttributeTypeUuid: {
      _type: Type.UUID,
      _default: '787f1ea9-1792-45e5-9076-699b1a0638cb',
      _description:
        'UUID opcional del person attribute type para estado de identificación: pending, partial, confirmed, merged.',
    },
    identificationStatusConcepts: {
      pendingUuid: {
        _type: Type.ConceptUuid,
        _default: 'bdb57e2a-d8fd-4e2b-8622-1ba60dcd3024',
        _description:
          'UUID opcional del concepto que representa estado de identificación = pendiente (si el person attribute type es Coded).',
      },
      partialUuid: {
        _type: Type.ConceptUuid,
        _default: '37ea79cb-9ae7-4297-8e56-8c374561c73c',
        _description:
          'UUID opcional del concepto que representa estado de identificación = parcial (si el person attribute type es Coded).',
      },
      confirmedUuid: {
        _type: Type.ConceptUuid,
        _default: '9e42f0f1-d989-4604-902e-8a33f474f01e',
        _description:
          'UUID opcional del concepto que representa estado de identificación = confirmado (si el person attribute type es Coded).',
      },
      mergedUuid: {
        _type: Type.ConceptUuid,
        _default: '8e9518a2-828d-4e50-a110-d964b63e51e2',
        _description:
          'UUID opcional del concepto que representa estado de identificación = fusionado (si el person attribute type es Coded).',
      },
    },
    administrativeNotesVisitAttributeTypeUuid: {
      _type: Type.UUID,
      _default: '6ffc9f6b-a9fb-434e-9b2d-4a2591cc16b3',
      _description:
        'UUID opcional del visit attribute type para observaciones administrativas de registro de emergencia.',
    },
    insuranceTypeConcepts: {
      sisGratuitoUuid: {
        _type: Type.ConceptUuid,
        _default: 'b61a9ff9-1485-4388-9f67-9c341f847f85',
        _description: 'UUID del concepto SIS Gratuito',
      },
      sisEmprendedorUuid: {
        _type: Type.ConceptUuid,
        _default: 'cc6958d9-7948-4f29-b244-4ff896c0b2ee',
        _description: 'UUID del concepto SIS Emprendedor',
      },
      sisSemicontributivoUuid: {
        _type: Type.ConceptUuid,
        _default: 'e43e0a71-0b5d-4fc2-b599-a76e4562ae5a',
        _description: 'UUID del concepto SIS Semicontributivo',
      },
      essaludUuid: {
        _type: Type.ConceptUuid,
        _default: 'af799b5e-313c-4352-80c4-5007dcd42f29',
        _description: 'UUID del concepto EsSalud',
      },
      privateUuid: {
        _type: Type.ConceptUuid,
        _default: 'ec420364-fde1-452d-9c48-fafb4ea73a58',
        _description: 'UUID del concepto Seguro Privado',
      },
      noneUuid: {
        _type: Type.ConceptUuid,
        _default: 'c69b424f-4d9c-4ba9-aeae-045ff5a5e530',
        _description: 'UUID del concepto Ninguno',
      },
    },
  },
};

export interface PriorityConfig {
  code: string;
  conceptUuid: string;
  label: string;
  description: string;
  color: PriorityTagColor;
  style: TagStyle | null;
  sortWeight: number;
  maxWaitTimeMinutes: number;
}

export interface Config {
  emergencyTriageQueueUuid: string;
  emergencyAttentionQueueUuid: string;
  emergencyServiceUuid: string;
  emergencyLocationUuid: string;
  upssEmergencyLocationUuid: string;
  queueStatuses: {
    waitingUuid: string;
    inServiceUuid: string;
    finishedServiceUuid: string;
  };
  priorityConfigs: Array<PriorityConfig>;
  concepts: {
    priorityIConceptUuid: string;
    priorityIIConceptUuid: string;
    priorityIIIConceptUuid: string;
    priorityIVConceptUuid: string;
    emergencyConceptUuid: string;
    urgencyConceptUuid: string;
  };
  triageEncounter: {
    encounterTypeUuid: string;
    vitalSignsConcepts: {
      temperatureUuid: string;
      heartRateUuid: string;
      respiratoryRateUuid: string;
      systolicBpUuid: string;
      diastolicBpUuid: string;
      oxygenSaturationUuid: string;
      consciousnessLevelUuid: string;
      weightUuid: string;
      heightUuid: string;
      anamnesisUuid: string;
      illnessDurationUuid: string;
      onsetTypeUuid: string;
      courseUuid: string;
      clinicalExamUuid: string;
    };
  };
  attentionEncounter: {
    encounterTypeUuid: string;
    concepts: {
      diagnosisUuid: string;
      treatmentUuid: string;
      auxiliaryExamsUuid: string;
    };
  };
  autoRefreshInterval: number;
  emergencyVisitTypeUuid: string;
  closeVisitOnDisposition: boolean;
  autoCreateVisitOnPatientSelect: boolean;
  promptVisitCreationOnNewPatient: boolean;
  patientRegistration: {
    defaultIdentifierTypeUuid: string;
    foreignCardIdentifierTypeUuid: string;
    passportIdentifierTypeUuid: string;
    dieIdentifierTypeUuid: string;
    liveBirthCertificateIdentifierTypeUuid: string;
    otherIdentifierTypeUuid: string;
    otherIdentifierFormat: string;
    otherIdentifierMaxLength: number;
    defaultLocationUuid: string;
    phoneNumberAttributeTypeUuid: string;
    identifierSourceUuid: string;
    openMrsIdIdentifierTypeUuid: string;
    unknownPatientAttributeTypeUuid: string;
    nationalityAttributeTypeUuid: string;
    nationalityConceptSetUuid: string;
    peruNationalityConceptUuid: string;
    insuranceTypeAttributeTypeUuid: string;
    insuranceCodeAttributeTypeUuid: string;
    companionNameAttributeTypeUuid: string;
    companionAgeAttributeTypeUuid: string;
    companionRelationshipAttributeTypeUuid: string;
    responsibleTypeAttributeTypeUuid: string | null;
    communicationConditionAttributeTypeUuid: string | null;
    identificationStatusAttributeTypeUuid: string | null;
    identificationStatusConcepts: {
      pendingUuid: string | null;
      partialUuid: string | null;
      confirmedUuid: string | null;
      mergedUuid: string | null;
    };
    administrativeNotesVisitAttributeTypeUuid: string | null;
    insuranceTypeConcepts: {
      sisGratuitoUuid: string;
      sisEmprendedorUuid: string;
      sisSemicontributivoUuid: string;
      essaludUuid: string;
      privateUuid: string;
      noneUuid: string;
    };
  };
}
