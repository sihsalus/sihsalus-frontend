import { Type } from '@openmrs/esm-framework';

export const configSchema = {
  enableFuaApprovalWorkflow: {
    _type: Type.Boolean,
    _default: false,
    _description: 'Habilitar el flujo de aprobación de FUA (Formato Único de Atención)',
  },
  fuaGeneratorEndpoint: {
    _type: Type.String,
    _default: 'http://gidis-hsc-dev.inf.pucp.edu.pe/services/fua-generator/demo',
    _description: 'URL del endpoint del generador de FUA (fallback cuando backend no disponible)',
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
    _default: '',
    _description: 'UUID del concepto de seguro SIS en OpenMRS',
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
  fuaApiBasePath: string;
};
