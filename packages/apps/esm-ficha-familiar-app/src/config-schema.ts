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
      _description: 'Cause of death concept UUID. Must be a Question/Coded concept.',
      _default: '9272a14b-7260-4353-9e5b-5787b5dead9d',
    },
    problemListConceptUuid: {
      _type: Type.ConceptUuid,
      _description: 'Problem list concept UUID',
      _default: '1284AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    },
    maritalStatusConceptUuid: {
      _type: Type.ConceptUuid,
      _description: 'Civil status concept UUID used when creating contacts. Must be a Question/Coded concept.',
      _default: 'aa345a81-3811-4e9c-be18-d6be727623e0',
    },
    partnerHivStatusConceptUuid: {
      _type: Type.ConceptUuid,
      _description: 'Partner HIV status concept UUID used by contact list workflows',
      _default: 'f5b9fcf6-2a36-448e-b135-387581d84ae7',
    },
    pnsApproachConceptUuid: {
      _type: Type.ConceptUuid,
      _description: 'Preferred PNS approach concept UUID used by contact list workflows',
      _default: '3d496077-411f-43f2-b151-263f2a76c761',
    },
    livingWithPatientConceptUuid: {
      _type: Type.ConceptUuid,
      _description: 'Living with patient concept UUID used by contact list workflows',
      _default: '7a3639b3-5a62-473b-b97d-d7661ce50aab',
    },
  },

  contactListConceptMap: {
    _type: Type.Object,
    _description: 'Display labels and answer labels used by the contact list forms',
    _default: {
      'f5b9fcf6-2a36-448e-b135-387581d84ae7': {
        display: 'Estado VIH del contacto',
        answers: {
          'b4454bf6-5e67-4235-9507-6875d784656d': 'Positivo',
          '707bd07e-7d27-4571-ad92-ec419af1a0f4': 'Negativo',
          '96b73231-84e5-4567-97b8-4713f559d9f0': 'Desconocido',
          'd8f64422-862b-4770-91a8-d3966988b2af': 'No desea responder',
        },
      },
      'aa345a81-3811-4e9c-be18-d6be727623e0': {
        display: 'Estado Civil',
        answers: {
          '798d5304-a301-4fb9-9a55-c568ab843c2d': 'Soltero(a)',
          'c40e34a1-47b4-4627-945f-bea67f9017df': 'Casado(a)',
          'bff95b64-d1b5-45ec-b5ad-a736c38a4cc1': 'Conviviente',
          'a10b6eeb-287f-4580-8ba7-9c8ee78a6ffc': 'Divorciado(a)',
          'b8e84a87-3dca-4c0b-a524-ef2b124166d4': 'Viudo(a)',
          '62bd5ec8-5ffb-4ddc-97b4-84fde7bab601': 'Otros',
          '3a88104a-3f04-4a43-8835-bc976b950527': 'No indicado',
        },
      },
      '171f88e2-b081-4b28-8c29-7d444a7b2745': {
        display: 'Contacto creado desde PNS',
        answers: {
          'f7e458ef-8dea-4e53-b429-81664cbeda49': 'Sí',
          '17455a61-ab7d-4bfb-a8d2-68f75a10d5f0': 'No',
        },
      },
      '3d496077-411f-43f2-b151-263f2a76c761': {
        display: 'Método de notificación PNS',
        answers: {
          '2f3b088e-4cf7-4088-935a-2a353af4b4df': 'Notificación por el paciente',
          '25018822-0be6-4ac7-8201-3a2d585c9afb': 'Notificación por el proveedor',
          '94287802-aba0-4cdb-af77-c4d5e91291b8': 'Notificación dual',
          '9a329153-735a-4614-ab43-269b67dc1367': 'Notificación anónima',
        },
      },
      '7a3639b3-5a62-473b-b97d-d7661ce50aab': {
        display: 'Convive con el paciente',
        answers: {
          'f7e458ef-8dea-4e53-b429-81664cbeda49': 'Sí',
          '17455a61-ab7d-4bfb-a8d2-68f75a10d5f0': 'No',
          'd8f64422-862b-4770-91a8-d3966988b2af': 'No desea responder',
        },
      },
    },
  },

  // Contact person attributes (PNS / HIV context)
  contactPersonAttributesUuid: {
    _type: Type.Object,
    _description: 'Person attribute type UUIDs for contact list fields',
    _default: {
      telephone: '14d4f066-15f5-102d-96e4-000c29c2a5d7',
      baselineHIVStatus: 'b978d331-e162-45b1-b9ca-65d3aa9a851f',
      contactCreated: 'e91775be-cf11-45e3-9b34-3c3f8849d4d6',
      preferedPnsAproach: '98c0a958-515e-4dec-a771-7a4cb9aa5492',
      livingWithContact: '1a951a91-231f-4a3a-9a22-e396fa93455c',
      contactipvOutcome: '81a8b164-befa-4cac-8978-da059082297c',
      dataConsent: '49ff9334-9d9-47d0-a236-72c0c9d4dea9',
    },
  },

  // HIV program UUID — used by the contact list HIV status check
  hivProgramUuid: {
    _type: Type.String,
    _description: 'HIV Program UUID',
    _default: '1eb6833d-fc44-4d2c-b243-ddab949479b3',
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
