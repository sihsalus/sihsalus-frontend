import { Type } from '@openmrs/esm-framework';

export interface ActiveVisitsConfigSchema {
  activeVisits: {
    pageSize: number;
    pageSizes: Array<number>;
    identifiers: Array<IdentifiersDefinition>;
    attributes: Array<ActiveVisitAttributeDefinition>;
    obs: Array<string>;
  };
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
};
