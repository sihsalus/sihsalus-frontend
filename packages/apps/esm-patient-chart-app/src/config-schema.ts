import { Type } from '@openmrs/esm-framework';

export const esmPatientChartSchema = {
  defaultFacilityUrl: {
    _type: Type.String,
    _default: '',
    _description: 'Custom URL to load default facility if it is not in the session',
  },
  disableChangingVisitLocation: {
    _type: Type.Boolean,
    _description: 'Whether the visit location field in the Start Visit form should be view-only.',
    _default: false,
  },
  disableEmptyTabs: {
    _type: Type.Boolean,
    _default: false,
    _description: 'Disable notes/tests/medications/encounters tabs when empty',
  },
  encounterEditableDuration: {
    _type: Type.Number,
    _default: 0,
    _description:
      'The number of minutes an encounter is editable after it is created. 0 means the encounter is editable forever.',
  },
  encounterEditableDurationOverridePrivileges: {
    _type: Type.Array,
    _elements: {
      _type: Type.String,
    },
    _default: [],
    _description: 'Privileges that allow editing encounters after the editable duration has expired.',
  },
  freeTextFieldConceptUuid: {
    _default: '5622AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    _type: Type.ConceptUuid,
  },
  logo: {
    alt: {
      _type: Type.String,
      _default: 'Logo',
      _description: 'Alt text, shown on hover',
    },
    name: {
      _type: Type.String,
      _default: '',
      _description: 'The organization name displayed when image is absent',
    },
    src: {
      _type: Type.String,
      _default: '',
      _description: 'A path or URL to an image. Defaults to the OpenMRS SVG sprite.',
    },
  },
  notesConceptUuids: {
    _type: Type.Array,
    _default: ['162169AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'],
  },
  diagnosisTypeConceptMap: {
    _type: Type.Object,
    _description: 'Concept UUID to diagnosis type mapping used when rendering visit diagnosis summaries.',
    _default: {
      '4f59cf03-f888-4d34-a5dc-f24269b1945d': 'presuntivo',
      '2c60a8f6-1787-41be-8434-30ebeb5656ff': 'definitivo',
      '6f653861-8469-4dfa-a0b5-2804f1cfc527': 'repetitivo',
    },
  },
  numberOfVisitsToLoad: {
    _type: Type.Number,
    _description: 'The number of visits to load initially in the Visits Summary tab. Defaults to 5',
    _default: 5,
  },
  obsConceptUuidsToHide: {
    _type: Type.Array,
    _elements: {
      _type: Type.ConceptUuid,
    },
    _description:
      'An array of concept UUIDs. If an observation has a concept UUID that matches any of the ones in this array, it will be hidden from the observations list in the Encounters summary table.',
    _default: [],
  },
  offlineVisitTypeUuid: {
    _type: Type.UUID,
    _description: 'The UUID of the visit type to be used for the automatically created offline visits.',
    _default: 'a22733fa-3501-4020-a520-da024eeff088',
  },
  FUATemplateUuid: {
    _type: Type.UUID,
    _description: 'The UUID of the FUA template form in OpenMRS.',
    _default: 'a22733fa-3501-4020-a520-da024eeff088',
  },
  fuaGeneratorEndpoint: {
    _type: Type.String,
    _default: '',
    _description: 'URL of the FUA HTML generator endpoint. Receives ?visitUuid=<uuid> and returns the FUA as HTML.',
  },
  restrictByVisitLocationTag: {
    _type: Type.Boolean,
    _description:
      'On the start visit form, whether to restrict the visit location to locations with the Visit Location tag',
    _default: true,
  },
  showAllEncountersTab: {
    _type: Type.Boolean,
    _description: 'Shows the All Encounters Tab of Patient Visits section in Patient Chart',
    _default: true,
  },
  showExtraVisitAttributesSlot: {
    _type: Type.Boolean,
    _description:
      'Whether on start visit form should handle submission of the extra visit attributes from the extra visit attributes slot',
    _default: false,
  },
  showRecommendedVisitTypeTab: {
    _type: Type.Boolean,
    _description: 'Whether start visit form should display recommended visit type tab. Requires `visitTypeResourceUrl`',
    _default: false,
  },
  showServiceQueueFields: {
    _type: Type.Boolean,
    _description: 'Whether start visit form should display service queue fields`',
    _default: false,
  },
  showUpcomingAppointments: {
    _type: Type.Boolean,
    _description: 'Whether start visit form should display upcoming appointments',
    _default: true,
  },
  tileDefinitions: {
    _type: Type.Array,
    _default: [
      {
        title: 'Weight and Height',
        columns: [
          {
            title: 'Weight',
            concept: '5089AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
            encounterType: '67a71486-1a54-468f-ac3e-7091a9a79584',
            hasSummary: true,
          },
          {
            title: 'Height',
            concept: '5090AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
            encounterType: '67a71486-1a54-468f-ac3e-7091a9a79584',
            hasSummary: true,
          },
        ],
      },
    ],
    _description: 'Definitions for clinical summary tiles with their concepts and encounter types',
  },
  requireActiveVisitForEncounterTile: {
    _type: Type.Boolean,
    _description: 'Whether to require an active visit for the encounter tile',
    _default: true,
  },
  drugOrderTypeUUID: {
    _type: Type.UUID,
    _description: "UUID for the 'Drug' order type to fetch medications",
    _default: '131168f4-15f5-102d-96e4-000c29c2a5d7',
  },
  visitAttributeTypes: {
    _type: Type.Array,
    _description: 'List of visit attribute types shown when filling the visit form',
    _elements: {
      uuid: {
        _type: Type.UUID,
        _description: 'UUID of the visit attribute type',
      },
      required: {
        _type: Type.Boolean,
        _description: 'Whether the attribute type field is required or not',
        _default: false,
      },
      displayInThePatientBanner: {
        _type: Type.Boolean,
        _description: "Whether we should show this visit attribute's value in the patient banner",
        _default: true,
      },
    },
    _default: [
      {
        uuid: '3a988e33-a6c0-4b76-b924-01abb998944b',
        required: false,
        displayInThePatientBanner: true,
      },
      {
        uuid: 'aac48226-d143-4274-80e0-264db4e368ee',
        required: false,
        displayInThePatientBanner: true,
      },
    ],
  },
  defaultVisitAttributesFromPersonAttributes: {
    _type: Type.Array,
    _description:
      'Mappings used to prefill visit attributes from patient person attributes when starting a visit. Values remain editable in the form.',
    _elements: {
      personAttributeTypeUuid: {
        _type: Type.UUID,
        _description: 'UUID of the person attribute type used as source',
      },
      visitAttributeTypeUuid: {
        _type: Type.UUID,
        _description: 'UUID of the visit attribute type used as target',
      },
    },
    _default: [
      {
        personAttributeTypeUuid: '56188294-b42c-481d-a987-4b495116c580',
        visitAttributeTypeUuid: '3a988e33-a6c0-4b76-b924-01abb998944b',
      },
      {
        personAttributeTypeUuid: '374b130f-7457-476f-87b1-f182aa77c434',
        visitAttributeTypeUuid: 'aac48226-d143-4274-80e0-264db4e368ee',
      },
    ],
  },
  visitDiagnosisConceptUuid: {
    _default: '159947AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    _type: Type.ConceptUuid,
  },
  visitTypeResourceUrl: {
    _type: Type.String,
    _default: '/etl-latest/etl/patient/',
    _description: 'Custom URL to load resources required for showing recommended visit types',
  },
  trueConceptUuid: {
    _type: Type.String,
    _description: 'Default concept uuid for true in forms',
    _default: '1065AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  },
  falseConceptUuid: {
    _type: Type.String,
    _description: 'Default concept uuid for false in forms',
    _default: '1066AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  },
  otherConceptUuid: {
    _type: Type.String,
    _description: 'Default concept uuid for other in forms',
    _default: '5622AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  },
};

export interface ChartConfig {
  defaultFacilityUrl: string;
  disableChangingVisitLocation: boolean;
  disableEmptyTabs: boolean;
  encounterEditableDuration: number;
  encounterEditableDurationOverridePrivileges: Array<string>;
  freeTextFieldConceptUuid: string;
  logo: {
    alt: string;
    name: string;
    src: string;
  };
  notesConceptUuids: string[];
  diagnosisTypeConceptMap: Record<string, 'presuntivo' | 'definitivo' | 'repetitivo'>;
  numberOfVisitsToLoad: number;
  offlineVisitTypeUuid: string;
  FUATemplateUuid: string;
  fuaGeneratorEndpoint: string;
  restrictByVisitLocationTag: boolean;
  showAllEncountersTab: boolean;
  showExtraVisitAttributesSlot: boolean;
  showRecommendedVisitTypeTab: boolean;
  showServiceQueueFields: boolean; // used by extension from esm-service-queues-app
  showUpcomingAppointments: boolean; // used by extension from esm-appointments-app
  tileDefinitions: Array<{
    title: string;
    columns: Array<{
      title: string;
      concept: string;
      encounterType: string;
      hasSummary?: boolean;
    }>;
  }>;
  visitTypeResourceUrl: string;
  visitAttributeTypes: Array<{
    displayInThePatientBanner: boolean;
    required: boolean;
    showWhenExpression?: string;
    uuid: string;
  }>;
  defaultVisitAttributesFromPersonAttributes: Array<{
    personAttributeTypeUuid: string;
    visitAttributeTypeUuid: string;
  }>;
  visitDiagnosisConceptUuid: string;
  requireActiveVisitForEncounterTile: boolean;
  trueConceptUuid: string;
  falseConceptUuid: string;
  otherConceptUuid: string;
  drugOrderTypeUUID: string;
}
