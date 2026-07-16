// ── Encounter representation ──
export const encounterRepresentation =
  'custom:(uuid,encounterDatetime,encounterType,location:(uuid,name),' +
  'patient:(uuid,display),encounterProviders:(uuid,provider:(uuid,name)),' +
  'obs:(uuid,obsDatetime,voided,groupMembers,concept:(uuid,name:(uuid,name)),value:(uuid,name:(uuid,name),' +
  'names:(uuid,conceptNameType,name))),form:(uuid,name))';

// ── Formatting ──
export const omrsDateFormat = 'YYYY-MM-DDTHH:mm:ss.SSSZZ';

// ── App info ──
export const moduleName = '@sihsalus/esm-seguimiento-casos-app';
export const caseMonitoringEditPrivilege = 'app:home.seguimientoCasos.editar';
export const chartCaseMonitoringEditPrivilege = 'app:hoja.clinica.seguimientoCasos.editar';
export const missedFollowUpEditPrivilege = 'app:hoja.clinica.perdidaSeguimiento.editar';

// ── Workspace names ──
export const patientFormEntryWorkspace = 'patient-form-entry-workspace';
