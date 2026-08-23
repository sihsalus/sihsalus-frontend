// ── Encounter representation ──
export const encounterRepresentation =
  'custom:(uuid,encounterDatetime,encounterType,location:(uuid,name),' +
  'patient:(uuid,display),encounterProviders:(uuid,provider:(uuid,name)),' +
  'obs:(uuid,obsDatetime,voided,groupMembers,concept:(uuid,name:(uuid,name)),value:(uuid,name:(uuid,name),' +
  'names:(uuid,conceptNameType,name))),form:(uuid,name))';

// ── Formatting ──
export const omrsDateFormat = 'YYYY-MM-DDTHH:mm:ss.SSSZZ';

// ── App info ──
export const moduleName = '@sihsalus/esm-atencion-ambulatoria-app';

// ── Workspace names ──
export const patientFormEntryWorkspace = 'patient-form-entry-workspace';
export const visitNotesFormWorkspace = 'visit-notes-form-workspace';

// ── Privileges ──
/** Declared by the order-basket workspace in esm-patient-orders-app/src/routes.json. */
export const consultaExternaPrivilege = 'app:hoja.clinica.consultaExterna';
export const consultaExternaEditPrivilege = 'app:hoja.clinica.consultaExterna.editar';
/** Declared by the Clinical Forms workspace window. */
export const clinicalFormsPrivilege = 'app:hoja.clinica.formulariosClinicos';
/** Declared by the Visit Notes workspace in esm-patient-notes-app/src/routes.json. */
export const visitNotesPrivilege = 'app:hoja.clinica.resumenConsulta';
export const visitNotesEditPrivilege = 'app:hoja.clinica.resumenConsulta.editar';
export const socialHistoryPrivilege = 'app:hoja.clinica.historiaSocial';
export const socialHistoryEditPrivilege = 'app:hoja.clinica.historiaSocial.editar';

export const orderBasketEditPrivilege = 'app:hoja.clinica.ordenes.editar';
/** Both privileges are required by the Order Basket window and workspace. */
export const orderBasketPrivileges = ['app:hoja.clinica.canastaOrdenes', orderBasketEditPrivilege];
