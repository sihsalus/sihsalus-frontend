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
  excludedDestinationConceptUuids: {
    _type: Type.Array,
    _description:
      'Conceptos operativos que pertenecen al catálogo compartido de colas pero no representan un consultorio o especialidad seleccionable.',
    _elements: {
      _type: Type.UUID,
    },
    _default: [
      'b866f130-b413-417f-ad5b-5b65daadbcf5',
      '51ce03e2-8987-4431-9e42-f8adca946c2c',
      '69d1f46b-c4cb-4760-afd2-d186c127f6ba',
      '5b3fc3a4-99a0-40ec-a1e2-058a032619c9',
      '0e4aef19-d959-42e3-bf0b-853d3296ed59',
      'e19800e7-c5a4-44b4-813d-04ad686e8151',
      '44a5c416-af63-40f6-8167-f283f40fcab0',
      '242d6a36-c921-4ad8-971e-89cf39df525d',
      'd0dc9239-a16f-4efb-a313-4b9135dca233',
      '0e56ea09-42ea-4f66-ad53-76cbc770dcfa',
      'e771ce10-6edd-4d17-a54c-e5de0762b7c7',
      'c10289d4-0f22-4f0e-8242-1835259404d5',
      // Duplicado LEGADO de la cola de consulta externa (concept 27857). El set
      // desplegado lo conserva junto al nuevo (51ce03e2, ya excluido); sin esta
      // entrada aparece como destino valido y una interconsulta dirigida ahi no
      // la monitorea ningun servicio. Verificado contra produccion el 2026-08-26.
      '7ba3aa21-cc56-47ca-bb4d-a60549f666c0',
    ],
  },
  externalSpecialistConceptUuid: {
    _type: Type.ConceptUuid,
    _description:
      'Concepto no codificado usado como destino de una interconsulta a un especialista externo o remoto. La especialidad concreta se conserva en las instrucciones de la orden.',
    _default: '4cf9f13f-bbac-50db-8fac-85205b58b44c',
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
  excludedDestinationConceptUuids: Array<string>;
  externalSpecialistConceptUuid: string;
  concepts: {
    respuestaConceptUuid: string;
    recomendacionesConceptUuid: string;
  };
}
