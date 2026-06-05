import { Type } from '@openmrs/esm-framework';

export const configSchema = {
  // Relationship type lists
  familyRelationshipsTypeList: {
    _type: Type.Array,
    _description: 'List of family relationship type UUIDs',
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
      { uuid: 'a2b5c9f8-0d2a-4bdf-8d9b-6f3b2d1e5a2f', display: 'Otro' },
    ],
  },

  otherRelationships: {
    _type: Type.Array,
    _description: 'List of other (non-family) relationship types',
    _default: [
      { uuid: '057de23f-3d9c-4314-9391-4452970739c6', display: 'Apoderado' },
      { uuid: 'a2b5c9f8-0d2a-4bdf-8d9b-6f3b2d1e5a2f', display: 'Otro' },
    ],
  },

  // Concepts used by family history widgets
  concepts: {
    probableCauseOfDeathConceptUuid: {
      _type: Type.ConceptUuid,
      _description: 'Probable cause of death concept UUID',
      _default: '1599AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    },
    problemListConceptUuid: {
      _type: Type.ConceptUuid,
      _description: 'Problem list concept UUID',
      _default: '1284AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    },
    maritalStatusConceptUuid: {
      _type: Type.ConceptUuid,
      _description: 'Civil status concept UUID used when creating contacts',
      _default: '1056AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    },
    partnerHivStatusConceptUuid: {
      _type: Type.ConceptUuid,
      _description: 'Partner HIV status concept UUID used by contact list workflows',
      _default: '1436AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    },
    pnsApproachConceptUuid: {
      _type: Type.ConceptUuid,
      _description: 'Preferred PNS approach concept UUID used by contact list workflows',
      _default: '7b827b42-9733-4d4f-8015-b40a07ac3052',
    },
    livingWithPatientConceptUuid: {
      _type: Type.ConceptUuid,
      _description: 'Living with patient concept UUID used by contact list workflows',
      _default: '36906d55-ade7-4d1a-b3b7-18fd59bffb0f',
    },
  },

  contactListConceptMap: {
    _type: Type.Object,
    _description: 'Display labels and answer labels used by the contact list forms',
    _default: {
      '1436AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA': {
        display: 'Partner HIV Status:',
        answers: {
          '703AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA': 'HIV Positive',
          '664AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA': 'HIV Negative',
          '1067AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA': 'Unknown',
        },
      },
      '1056AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA': {
        display: 'Civil status',
        answers: {
          '1057AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA': 'Single',
          '1058AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA': 'Divorced',
          '1059AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA': 'Widowed',
          '159715AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA': 'Married Polygamous',
          '5555AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA': 'Married Monogamous',
        },
      },
      'a6b3803f-e594-4318-8624-3eaed46322a7': {
        display: 'Add Patient Contact',
        answers: {
          'cf82933b-3f3f-45e7-a5ab-5d31aaee3da3': 'Yes',
          '488b58ff-64f5-4f8a-8979-fa79940b1594': 'No',
        },
      },
      '7b827b42-9733-4d4f-8015-b40a07ac3052': {
        display: 'Prefered PNS Aproach',
        answers: {
          '160551AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA': 'Passive referral',
          '161642AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA': 'Contract referral',
          '163096AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA': 'Provider referral',
          '162284AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA': 'Dual referral',
        },
      },
      '36906d55-ade7-4d1a-b3b7-18fd59bffb0f': {
        display: 'Living with client',
        answers: {
          'cf82933b-3f3f-45e7-a5ab-5d31aaee3da3': 'Yes',
          '488b58ff-64f5-4f8a-8979-fa79940b1594': 'No',
          '162570AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA': 'Declined to answer',
        },
      },
    },
  },

  // Contact person attributes (PNS / HIV context)
  contactPersonAttributesUuid: {
    _type: Type.Object,
    _description: 'Person attribute type UUIDs for contact list fields',
    _default: {
      telephone: 'b2c38640-2603-4629-aebd-3b54f33f1e3a',
      baselineHIVStatus: '3ca03c84-632d-4e53-95ad-91f1bd9d96d6',
      contactCreated: '7c94bd35-fba7-4ef7-96f5-29c89a318fcf',
      preferedPnsAproach: '59d1b886-90c8-4f7f-9212-08b20a9ee8cf',
      livingWithContact: '35a08d84-9f80-4991-92b4-c4ae5903536e',
      contactipvOutcome: '49c543c2-a72a-4b0a-8cca-39c375c0726f',
      dataConsent: 'a7c3e2f1-9b4d-4e8a-b15c-2d6f8e3a1c90',
    },
  },

  // HIV program UUID — used by the contact list HIV status check
  hivProgramUuid: {
    _type: Type.String,
    _description: 'HIV Program UUID',
    _default: 'dfdc6d40-2f2f-463d-ba90-cc97350441a8',
  },

  // Encounter type for HIV testing — used by contact list HTS status check
  encounterTypes: {
    hivTestingServices: {
      _type: Type.UUID,
      _description: 'HIV Testing Services encounter type UUID',
      _default: '5cbb797f-bed5-4301-a3ce-6cc7eb7c687b',
    },
  },

  formsList: {
    _type: Type.Object,
    _description: 'List of form UUIDs used by relationship workflows',
    _default: {
      htsInitialTest: '402dc5d7-46da-42d4-b2be-f43ea4ad87b0',
    },
  },

  // Patient registration config — used when creating a new relative during relationship form
  defaultIDUuid: {
    _type: Type.String,
    _description: 'Patient identifier type UUID',
    _default: '05a29f94-c0ed-11e2-94be-8c13b969e334',
  },

  defaultIdentifierSourceUuid: {
    _type: Type.String,
    _description: 'IdGen identifier source UUID',
    _default: '8549f706-7e85-4c1d-9424-217d50a2988b',
  },

  maritalStatusUuid: {
    _type: Type.String,
    _description: 'Marital status concept UUID',
    _default: 'aa345a81-3811-4e9c-be18-d6be727623e0',
  },

  registrationEncounterUuid: {
    _type: Type.String,
    _description: 'Registration encounter type UUID',
    _default: 'de1f9d67-b73e-4e1b-90d0-036166fc6995',
  },

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
};

export interface ConfigObject {
  familyRelationshipsTypeList: Array<{ uuid: string; display: string }>;
  pnsRelationships: Array<{ uuid: string; display: string; sexual?: boolean }>;
  otherRelationships: Array<{ uuid: string; display: string }>;
  concepts: {
    probableCauseOfDeathConceptUuid: string;
    problemListConceptUuid: string;
    maritalStatusConceptUuid: string;
    partnerHivStatusConceptUuid: string;
    pnsApproachConceptUuid: string;
    livingWithPatientConceptUuid: string;
  };
  contactListConceptMap: Record<string, { display: string; answers: Record<string, string> }>;
  contactPersonAttributesUuid: {
    telephone: string;
    baselineHIVStatus: string;
    contactCreated: string;
    preferedPnsAproach: string;
    livingWithContact: string;
    contactipvOutcome: string;
    dataConsent: string;
  };
  hivProgramUuid: string;
  encounterTypes: {
    hivTestingServices: string;
  };
  formsList: {
    htsInitialTest: string;
  };
  defaultIDUuid: string;
  defaultIdentifierSourceUuid: string;
  maritalStatusUuid: string;
  registrationEncounterUuid: string;
  registrationObs: {
    encounterTypeUuid: string | null;
    encounterProviderRoleUuid: string;
    registrationFormUuid: string | null;
  };
}
