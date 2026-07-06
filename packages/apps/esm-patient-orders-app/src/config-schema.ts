import { Type } from '@openmrs/esm-framework';

export const configSchema = {
  orderEncounterType: {
    _type: Type.UUID,
    _description: 'The encounter type of the encounter encapsulating orders',
    _default: '39da3525-afe4-45ff-8977-c53b7b359158',
  },
  careSettingUuid: {
    _type: Type.UUID,
    _description: 'Care setting UUID used when querying and submitting patient orders',
    _default: '6f0c9a92-6f24-11e3-af88-005056821db0',
  },
  showPrintButton: {
    _type: Type.Boolean,
    _description:
      'Determines whether or not to display a Print button in the Orders details table. If set to true, a Print button gets shown in both the orders table headers. When clicked, this button enables the user to print out the contents of the table',
    _default: true,
  },
  orderTypes: {
    _type: Type.Array,
    _default: [
      {
        orderTypeUuid: 'f9c5d0b8-8b5a-11e5-8e9b-12345678a01a',
        label: 'Órdenes de radiología',
        icon: 'omrs-icon-image-medical',
        orderableConceptSets: [],
      },
      {
        orderTypeUuid: 'e1f95924-697a-11e3-bd76-0800271c1b75',
        label: 'Órdenes de inmunización',
        icon: 'omrs-icon-syringe',
        orderableConceptSets: [],
      },
      {
        orderTypeUuid: 'f3c2e4b6-8b5a-11e5-8e9b-12345678901b',
        label: 'Órdenes de interconsulta',
        icon: 'omrs-icon-referral-order',
        orderableConceptSets: [],
      },
    ],
    _description: 'List of various order types, each associated with the Java class name `org.openmrs.Order`.',
    _elements: {
      orderTypeUuid: {
        _type: Type.UUID,
        _description: 'The UUID of the order type listed in the order basket',
      },
      orderableConceptSets: {
        _type: Type.Array,
        _description:
          "UUIDs of concepts that represent orderable concepts. Either the `conceptClass` should be given, or the `orderableConcepts`. If the orderableConcepts are not given, then it'll search concepts by concept class.",
        _elements: {
          _type: Type.UUID,
        },
      },
      label: {
        _type: Type.String,
        _description:
          'The custom label to be shown for the order type. The label will be translated with the key as the label itself.',
      },
      icon: {
        _type: Type.String,
        _description: 'Icon to be shown for the order type. Icons are from the OpenMRS icon library.',
        _default: '',
      },
    },
  },
  showReferenceNumberField: {
    _type: Type.Boolean,
    _default: false,
    _description:
      'Whether to display the Reference number field in the Order form. This field maps to the accesion_number property in the Order data model',
  },
  priorityConfigs: {
    _type: Type.Array,
    _description:
      'Priority options for orders, mapped to concept UUIDs. Replaces the hardcoded ROUTINE/STAT/ON_SCHEDULED_DATE values.',
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

export interface OrderTypeDefinition {
  label?: string;
  orderTypeUuid: string;
  orderableConceptSets: Array<string>;
  icon?: string;
}

export interface PriorityConfig {
  conceptUuid: string;
  label: string;
  /** Core OpenMRS urgency this priority maps to when posting the order. */
  urgency: 'ROUTINE' | 'STAT' | 'ON_SCHEDULED_DATE';
  requiresScheduledDate?: boolean;
}

export interface ConfigObject {
  orderEncounterType: string;
  careSettingUuid: string;
  showPrintButton: boolean;
  orderTypes: Array<OrderTypeDefinition>;
  showReferenceNumberField: boolean;
  priorityConfigs: Array<PriorityConfig>;
}
