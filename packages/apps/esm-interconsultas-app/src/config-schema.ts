import { Type } from '@openmrs/esm-framework';

export const configSchema = {
  interconsultaOrderTypeUuid: {
    _type: Type.UUID,
    _description: 'Order type que representa una interconsulta (mismo usado por el order basket)',
    _default: 'f3c2e4b6-8b5a-11e5-8e9b-12345678901b',
  },
  careSettingUuid: {
    _type: Type.UUID,
    _description: 'Care setting usado al crear y consultar interconsultas',
    _default: '6f0c9a92-6f24-11e3-af88-005056821db0',
  },
  requestEncounterTypeUuid: {
    _type: Type.UUID,
    _description: 'Encounter type del encuentro que encapsula la solicitud de interconsulta (Interconsulta — NTS 102)',
    _default: 'e4834799-7f43-4552-a6f3-2656880ca52f',
  },
  clinicianEncounterRoleUuid: {
    _type: Type.UUID,
    _description: 'Encounter role asignado al profesional solicitante en el encuentro de solicitud',
    _default: '240b26f9-dd88-4172-823d-4a8bfeb7841f',
  },
  orderableConceptSets: {
    _type: Type.Array,
    _description:
      'UUIDs de concept sets cuyos miembros son los servicios/especialidades destino ordenables. ' +
      'Si está vacío, el formulario busca concepts por texto libre.',
    _elements: {
      _type: Type.UUID,
    },
    _default: ['4bf3f465-ac91-44fa-9b1f-173daf0c89a0'],
  },
  concepts: {
    respuestaConceptUuid: {
      _type: Type.ConceptUuid,
      _description: 'Concept (texto) usado para registrar la respuesta de la interconsulta como obs ligada a la orden',
      _default: 'f0000174-0000-4000-8000-000000000174',
    },
    recomendacionesConceptUuid: {
      _type: Type.ConceptUuid,
      _description:
        'Concept (texto) para registrar recomendaciones de la respuesta. Si se deja vacío, ' +
        'las recomendaciones se anexan al texto de la respuesta.',
      _default: '',
    },
  },
};

export interface ConfigObject {
  interconsultaOrderTypeUuid: string;
  careSettingUuid: string;
  requestEncounterTypeUuid: string;
  clinicianEncounterRoleUuid: string;
  orderableConceptSets: Array<string>;
  concepts: {
    respuestaConceptUuid: string;
    recomendacionesConceptUuid: string;
  };
}
