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
}
