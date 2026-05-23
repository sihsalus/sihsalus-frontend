import { Type, validators } from '@openmrs/esm-framework';

const priorityTagColors = [
  'red',
  'magenta',
  'purple',
  'blue',
  'cyan',
  'teal',
  'gray',
  'orange',
  'green',
  'warm-gray',
  'cool-gray',
  'high-contrast',
  'outline',
] as const;

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
        conceptUuid: 'bf3a08c6-cbe6-4f00-8e06-5f5437790b85',
        label: 'Rutina',
        requiresScheduledDate: false,
      },
      {
        conceptUuid: '933e6d55-d64a-498d-b1b2-b3d5242e4199',
        label: 'Emergencia',
        requiresScheduledDate: false,
      },
      {
        conceptUuid: '1606e719-d480-40c9-b586-835458ad0a96',
        label: 'Urgente',
        requiresScheduledDate: false,
      },
      {
        conceptUuid: 'f98c88d0-8b5a-11e5-8e9b-123456789abc',
        label: 'Programado',
        requiresScheduledDate: true,
      },
    ],
    _elements: {
      conceptUuid: {
        _type: Type.ConceptUuid,
        _description: 'UUID del concepto de prioridad en OpenMRS',
      },
      label: {
        _type: Type.String,
        _description: 'Etiqueta visible para la prioridad',
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
