import { Type } from '@openmrs/esm-framework';

export const configSchema = {
  resultsViewerConcepts: {
    _type: Type.Array,
    _elements: {
      conceptUuid: {
        _type: Type.UUID,
        _description: `UUID of a test or a concept set containing tests as members, members' members, and so on. Test results will be loaded by querying the REST /obstree endpoint with this concept.`,
      },
      defaultOpen: {
        _type: Type.Boolean,
        _description:
          'Each concept set displays the test results it contains in an accordion. Should the accordion be open by default?',
      },
    },
    _default: [
      {
        conceptUuid: '24305e8e-f3dc-4ac6-bf87-e4f11f3b970e',
        defaultOpen: false,
      },
      {
        conceptUuid: '7e750f3a-8d5c-45b1-8e94-ebf850208e35',
        defaultOpen: false,
      },
      {
        conceptUuid: 'df144cc2-6718-4005-9881-f39eafd73315',
        defaultOpen: false,
      },
      {
        conceptUuid: '339febfd-699e-4a26-927f-1f9a7780bb5e',
        defaultOpen: false,
      },
      {
        conceptUuid: '241eb982-1fdd-4183-a2b5-763f5ce2d528',
        defaultOpen: false,
      },
      {
        conceptUuid: '1bcb541a-55e8-4c5d-83fb-d121a9d54d9d',
        defaultOpen: false,
      },
      {
        conceptUuid: '654b11a8-a326-45c9-885e-2fae6143404a',
        defaultOpen: false,
      },
      {
        conceptUuid: '968c8a41-ab1b-426c-86ee-761b88c26e40',
        defaultOpen: false,
      },
      {
        conceptUuid: 'ef0a9d25-658b-466b-9b7e-4571673b28b0',
        defaultOpen: false,
      },
      {
        conceptUuid: '7969c932-60db-4a38-8723-2f3a5bba8c16',
        defaultOpen: false,
      },
      {
        conceptUuid: 'bb3af485-89b6-4c04-848c-8d024a6b4a7a',
        defaultOpen: false,
      },
    ],
  },
  orders: {
    careSettingUuid: {
      _type: Type.UUID,
      _description: 'Care setting UUID used when querying and submitting lab/test orders',
      _default: '6f0c9a92-6f24-11e3-af88-005056821db0',
    },
    labOrderTypeUuid: {
      _type: Type.UUID,
      _description: "UUID for the 'Lab' order type",
      _default: '52a447d3-a64a-11e3-9aeb-50e549534c5e',
    },
    labOrderableConcepts: {
      _type: Type.Array,
      _description: 'UUIDs of concepts that represent orderable lab tests or lab sets.',
      _elements: {
        _type: Type.UUID,
      },
      _default: ['020e5471-8750-44f6-82dd-af6d8eb63544'],
    },
  },
  showReferenceNumberField: {
    _type: Type.Boolean,
    _default: false,
    _description:
      'Whether to display the Reference number field in the Test Order form. This field maps to the accesion_number property in the Order data model',
  },
  additionalTestOrderTypes: {
    _type: Type.Array,
    _description: 'List of various order types, each associated with the Java class name `org.openmrs.TestOrder`.',
    _elements: {
      _type: Type.Object,
      orderTypeUuid: {
        _type: Type.UUID,
        _description: 'UUID for the new order type',
      },
      label: {
        _type: Type.String,
        _description:
          'The custom label to be shown for the order type. The label will be translated using the label as the key itself.',
      },
      orderableConceptSets: {
        _type: Type.UUID,
        _description:
          'UUIDs of concepts that represent orderable concept sets. If an empty array `[]` is provided, every concept with class mentioned in the `orderableConceptClasses` will be considered orderable.',
      },
      icon: {
        _type: Type.String,
        _description: 'Icon to be shown for the order type. Icons are from the OpenMRS icon library.',
        _default: '',
      },
    },
    _default: [],
  },
  labTestsWithOrderReasons: {
    _type: Type.Array,
    _elements: {
      labTestUuid: {
        _type: Type.UUID,
        _description: 'UUID of the lab test that requires a reason for ordering',
        _default: '',
      },
      required: {
        _type: Type.Boolean,
        _description: 'Whether the order reason is required or not',
        _default: false,
      },
      orderReasons: {
        _type: Type.Array,
        _elements: {
          _type: Type.ConceptUuid,
          _description: 'Array of coded concepts that represent reasons for ordering a lab test',
        },
        _default: [],
        _description: 'Coded Lab test order reason options',
      },
    },
    _default: [],
    _description: 'Whether to allow for provision of coded order reason',
  },
  priorityConfigs: {
    _type: Type.Array,
    _description:
      'Priority options for test orders, mapped to concept UUIDs. Replaces the hardcoded ROUTINE/STAT/ON_SCHEDULED_DATE values.',
    _default: [
      {
        conceptUuid: 'e724bdb6-2c75-4b6f-a00c-d43f2c372974', // Emergencia
        label: 'Emergencia',
        urgency: 'STAT',
        requiresScheduledDate: false,
      },
      {
        conceptUuid: 'b96959db-2106-4ce7-b39b-6fcb2ca88cda', // Urgente
        label: 'Urgente',
        urgency: 'STAT',
        requiresScheduledDate: false,
      },
      {
        conceptUuid: '427a595a-a5ee-4ba7-bcb7-2503248efb31', // Urgencia menor
        label: 'Urgencia menor',
        urgency: 'ROUTINE',
        requiresScheduledDate: false,
      },
      {
        conceptUuid: 'bf3a08c6-cbe6-4f00-8e06-5f5437790b85', // No Urgente
        label: 'Rutina',
        urgency: 'ROUTINE',
        requiresScheduledDate: false,
      },
      {
        conceptUuid: '65cf194e-05a7-4832-ba6d-9b7c9940a7c2', // Programado
        label: 'Programado',
        urgency: 'ON_SCHEDULED_DATE',
        requiresScheduledDate: true,
      },
    ],
    _elements: {
      conceptUuid: {
        _type: Type.ConceptUuid,
        _description: 'UUID del concepto de prioridad en OpenMRS (para etiqueta y reporte MINSA)',
      },
      label: {
        _type: Type.String,
        _description: 'Etiqueta visible para la prioridad',
      },
      urgency: {
        _type: Type.String,
        _description:
          'Urgencia core de OpenMRS a la que mapea esta prioridad al postear la orden: ROUTINE, STAT u ON_SCHEDULED_DATE',
      },
      requiresScheduledDate: {
        _type: Type.Boolean,
        _description: 'Si es true, se muestra el campo de fecha programada al seleccionar esta prioridad',
        _default: false,
      },
    },
  },
};

export interface ObsTreeEntry {
  conceptUuid: string;
  defaultOpen: boolean;
}

export interface LabTestReason {
  uuid: string;
  label?: string;
}

export interface OrderReason {
  labTestUuid: string;
  orderReasons: Array<string>;
  required: boolean;
}

export interface PriorityConfig {
  conceptUuid: string;
  label: string;
  /** Core OpenMRS urgency this priority maps to when posting the order. */
  urgency: 'ROUTINE' | 'STAT' | 'ON_SCHEDULED_DATE';
  requiresScheduledDate?: boolean;
}

export interface ConfigObject {
  labTestsWithOrderReasons: Array<OrderReason>;
  orders: {
    careSettingUuid: string;
    labOrderTypeUuid: string;
    labOrderableConcepts: Array<string>;
  };
  showReferenceNumberField: boolean;
  additionalTestOrderTypes: Array<{
    label?: string;
    orderTypeUuid: string;
    orderableConceptSets: Array<string>;
    icon?: string;
  }>;
  resultsViewerConcepts: Array<ObsTreeEntry>;
  priorityConfigs: Array<PriorityConfig>;
}
