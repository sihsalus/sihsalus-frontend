import {
  SIS_ACCREDITATION_ACTIVE_CONCEPT_UUID,
  SIS_ACCREDITATION_INACTIVE_CONCEPT_UUID,
  SIS_ACCREDITATION_NOT_CONSULTED_CONCEPT_UUID,
  SIS_ACCREDITATION_PENDING_CONCEPT_UUID,
} from '@openmrs/esm-patient-common-lib';

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
// en @openmrs/esm-patient-common-lib, la fuente canónica de estos UUID.
export const sisAccreditationVigenteConceptUuid = SIS_ACCREDITATION_ACTIVE_CONCEPT_UUID;
export const sisAccreditationNoVigenteConceptUuid = SIS_ACCREDITATION_INACTIVE_CONCEPT_UUID;
export const sisAccreditationPendienteConceptUuid = SIS_ACCREDITATION_PENDING_CONCEPT_UUID;
export const sisAccreditationNoConsultadaConceptUuid = SIS_ACCREDITATION_NOT_CONSULTED_CONCEPT_UUID;
