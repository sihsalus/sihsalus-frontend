import { Type } from '@openmrs/esm-framework';
import {
  LEGACY_SIS_PRODUCT_CONCEPT_UUIDS,
  SIS_ACCREDITATION_NOT_CONSULTED_CONCEPT_UUID,
  SIS_ACCREDITATION_PENDING_CONCEPT_UUID,
  SIS_CONCEPT_UUID,
} from '@openmrs/esm-patient-common-lib';

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
    sisConceptUuids: {
      _type: Type.Array,
      _description:
        'Conceptos de financiador que cuentan como SIS: primero el concepto canónico y después los productos SIS legados.',
      _elements: {
        _type: Type.UUID,
        _description: 'UUID de un concepto de financiador SIS.',
      },
      _default: [SIS_CONCEPT_UUID, ...LEGACY_SIS_PRODUCT_CONCEPT_UUIDS],
    },
    pendingStatusConceptUuid: {
      _type: Type.UUID,
      _description: 'Concepto "Acreditación pendiente".',
      _default: SIS_ACCREDITATION_PENDING_CONCEPT_UUID,
    },
    notConsultedStatusConceptUuid: {
      _type: Type.UUID,
      _description: 'Concepto "Acreditación no consultada".',
      _default: SIS_ACCREDITATION_NOT_CONSULTED_CONCEPT_UUID,
    },
    dniIdentifierTypeUuid: {
      _type: Type.UUID,
      _description: 'Identifier type DNI, mostrado con prioridad en la lista de acreditaciones pendientes.',
      _default: '550e8400-e29b-41d4-a716-446655440001',
    },
  },
};
