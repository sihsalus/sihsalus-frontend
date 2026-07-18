import { Type } from '@openmrs/esm-framework';
import { LEGACY_SIS_PRODUCT_CONCEPT_UUIDS, SIS_CONCEPT_UUID } from '@openmrs/esm-patient-common-lib';

export const configSchema = {
  enableFuaApprovalWorkflow: {
    _type: Type.Boolean,
    _default: false,
    _description: 'Habilitar el flujo de aprobación de FUA (Formato Único de Atención)',
  },
  fuaGeneratorEndpoint: {
    _type: Type.String,
    _default: '',
    _description:
      'URL del endpoint del generador de FUA. Dejar vacío para usar la ruta relativa del gateway del distro ' +
      '(/services/fua-generator), que el gateway ya proxya al microservicio. Configurar una URL absoluta solo ' +
      'para entornos que no pasan por el gateway.',
  },
  encounterTypeUuid: {
    _type: Type.UUID,
    _default: '186c1e78-b9c0-44ab-be51-5b7eddfe4c2e',
    _description: 'UUID del tipo de encuentro Consulta Externa para FUA',
  },
  clinicianEncounterRole: {
    _type: Type.UUID,
    _default: '240b26f9-dd88-4172-823d-4a8bfeb7841f',
    _description: 'UUID del encounter role clínico usado al crear el encuentro para FUA',
  },
  cie10ConceptSetUuid: {
    _type: Type.UUID,
    _default: '',
    _description: 'UUID del concept set raíz para búsqueda de diagnósticos CIE-10',
  },
  sisInsuranceConceptUuid: {
    _type: Type.UUID,
    _default: SIS_CONCEPT_UUID,
    _description:
      'UUID del concepto SIS del catálogo canónico «Tipo de seguro». Solo las visitas cuyo visit attribute ' +
      'Financiador tenga este valor (o uno de legacySisProductConceptUuids) son candidatas a FUA.',
  },
  legacySisProductConceptUuids: {
    _type: Type.Array,
    _element: { _type: Type.UUID },
    _default: [...LEGACY_SIS_PRODUCT_CONCEPT_UUIDS],
    _description:
      'UUIDs de conceptos legacy de productos SIS (Gratuito, Semicontributivo, Emprendedor) que datos existentes ' +
      'pueden tener como Financiador de la visita. Se tratan como SIS para el gating de FUA.',
  },
  fuaApiBasePath: {
    _type: Type.String,
    _default: '/ws/module/fua',
    _description: 'Base path del módulo FUA en el backend OpenMRS',
  },
};

export type Config = {
  enableFuaApprovalWorkflow: boolean;
  fuaGeneratorEndpoint: string;
  encounterTypeUuid: string;
  clinicianEncounterRole: string;
  cie10ConceptSetUuid: string;
  sisInsuranceConceptUuid: string;
  legacySisProductConceptUuids: Array<string>;
  fuaApiBasePath: string;
};
