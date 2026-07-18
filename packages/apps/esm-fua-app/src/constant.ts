export const ModuleFuaRestURL = '/ws/module/fua';
export const FuaFormatRestURL = '/ws/FUAFormat';
export const fuaReadPrivilege = 'app:home.fua';
export const fuaManagePrivilege = 'app:home.fua.editar';
export const fuaUpdatePrivilege = 'app:home.fua.editar';

/**
 * Ruta relativa del generador de FUA detrás del gateway del distro
 * (el gateway proxya /services/fua-generator al microservicio).
 */
export const fuaGeneratorGatewayPath = '/services/fua-generator';

/**
 * Resuelve el endpoint del generador de FUA: usa el valor configurado
 * (`fuaGeneratorEndpoint`) y, si está vacío, la ruta relativa del gateway.
 */
export function resolveFuaGeneratorEndpoint(configuredEndpoint: string | null | undefined): string {
  return configuredEndpoint?.trim() || fuaGeneratorGatewayPath;
}

// ── Estado de Acreditación SIS (respuestas del visit attribute coded) ────────
// Visit attribute type: SIS_ACCREDITATION_STATUS_VISIT_ATTRIBUTE_TYPE_UUID
// (5e13e902-2030-4f65-b9d5-9a4810c9a603) en @openmrs/esm-patient-common-lib.
export const sisAccreditationVigenteConceptUuid = '9b3df0a1-0c58-4f55-9868-9c38f1db2051';
export const sisAccreditationNoVigenteConceptUuid = '9b3df0a1-0c58-4f55-9868-9c38f1db2052';
export const sisAccreditationPendienteConceptUuid = '9b3df0a1-0c58-4f55-9868-9c38f1db2053';
export const sisAccreditationNoConsultadaConceptUuid = '9b3df0a1-0c58-4f55-9868-9c38f1db2054';
