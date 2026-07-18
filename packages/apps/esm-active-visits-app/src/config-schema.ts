import { Type } from '@openmrs/esm-framework';

export interface ActiveVisitsConfigSchema {
  activeVisits: {
    pageSize: number;
    pageSizes: Array<number>;
    identifiers: Array<IdentifiersDefinition>;
    attributes: Array<ActiveVisitAttributeDefinition>;
    obs: Array<string>;
  };
  pendingSisAccreditations: PendingSisAccreditationsConfig;
}

export interface PendingSisAccreditationsConfig {
  financiadorVisitAttributeTypeUuid: string;
  accreditationStatusVisitAttributeTypeUuid: string;
  sisConceptUuids: Array<string>;
  pendingStatusConceptUuid: string;
  notConsultedStatusConceptUuid: string;
  dniIdentifierTypeUuid: string;
}

export interface IdentifiersDefinition {
  id: number;
  header: {
    key: string;
    default: string;
  };
  identifierName: string;
}

export interface ActiveVisitAttributeDefinition {
  display: string;
  header: {
    key: string;
    default: string;
  };
}

export const configSchema = {
  activeVisits: {
    identifiers: {
      _type: Type.Array,
      _description: 'Customizable list of identifiers to display on active visits table',
      _elements: {
        header: {
          key: {
            _type: Type.String,
            _default: null,
            _description: 'Key to be used for translation purposes.',
          },
          default: {
            _type: Type.String,
            _default: null,
            _description: 'Default text to be displayed if no translation is found.',
          },
        },
        identifierName: {
          _type: Type.String,
          _default: null,
          _description: 'Name of the desired identifier to filter data returned from the visit resource.',
        },
      },
      _default: [
        {
          header: { key: 'dni', default: 'DNI' },
          identifierName: 'DNI',
        },
        {
          header: { key: 'historyNumber', default: 'N° Historia Clínica' },
          identifierName: 'N° Historia Clínica',
        },
      ],
    },
    attributes: {
      _type: Type.Array,
      _description: 'Customizable list of patient person attributes to display on active visits table.',
      _elements: {
        display: {
          _type: Type.String,
          _default: null,
          _description: 'Display name of the person attribute type to include.',
        },
        header: {
          key: {
            _type: Type.String,
            _default: null,
            _description: 'Key to be used for translation purposes.',
          },
          default: {
            _type: Type.String,
            _default: null,
            _description: 'Default text to be displayed if no translation is found.',
          },
        },
      },
      _default: [],
    },
    pageSize: {
      _type: Type.Number,
      _description: 'Count of active visits to be shown in a single page.',
      _default: 10,
    },
    pageSizes: {
      _type: Type.Array,
      _description: 'Customizable page sizes that user can choose',
      _default: [10, 20, 50],
    },
    obs: {
      _type: Type.Array,
      _description: 'Array of observation concept UUIDs to be displayed on the active visits table.',
      _elements: {
        _type: Type.UUID,
        _description: 'UUID of an observation concept.',
      },
      _default: [],
    },
  },
  pendingSisAccreditations: {
    financiadorVisitAttributeTypeUuid: {
      _type: Type.UUID,
      _description: 'Visit attribute type "Financiador" (fuente de verdad del financiador de la visita).',
      _default: '3a988e33-a6c0-4b76-b924-01abb998944b',
    },
    accreditationStatusVisitAttributeTypeUuid: {
      _type: Type.UUID,
      _description: 'Visit attribute type "Estado de Acreditación SIS".',
      _default: '5e13e902-2030-4f65-b9d5-9a4810c9a603',
    },
    sisConceptUuids: {
      _type: Type.Array,
      _description: 'Conceptos de financiador que cuentan como SIS: el concepto canónico y los productos SIS legados.',
      _elements: {
        _type: Type.UUID,
        _description: 'UUID de un concepto de financiador SIS.',
      },
      _default: [
        '97c6e901-7570-4ab8-a9c0-9cf2b0f5bc0c', // SIS (canónico)
        'b61a9ff9-1485-4388-9f67-9c341f847f85', // SIS Gratuito (legado)
        'e43e0a71-0b5d-4fc2-b599-a76e4562ae5a', // SIS Semicontributivo (legado)
        'cc6958d9-7948-4f29-b244-4ff896c0b2ee', // SIS Emprendedor (legado)
      ],
    },
    pendingStatusConceptUuid: {
      _type: Type.UUID,
      _description: 'Concepto "Acreditación pendiente".',
      _default: '9b3df0a1-0c58-4f55-9868-9c38f1db2053',
    },
    notConsultedStatusConceptUuid: {
      _type: Type.UUID,
      _description: 'Concepto "Acreditación no consultada".',
      _default: '9b3df0a1-0c58-4f55-9868-9c38f1db2054',
    },
    dniIdentifierTypeUuid: {
      _type: Type.UUID,
      _description: 'Identifier type DNI, mostrado con prioridad en la lista de acreditaciones pendientes.',
      _default: '550e8400-e29b-41d4-a716-446655440001',
    },
  },
};
