export const clinicalFormsWorkspace = 'clinical-forms-workspace';
export const formEntryWorkspace = 'patient-form-entry-workspace';
export const spaRoot = window['getOpenmrsSpaBase']();
export const basePath = '/patient/:patientUuid/chart';
export const dashboardPath = `${basePath}/:view/*`;
export const spaBasePath = `${globalThis.spaBase}${basePath}`;
export const adtPrivilege = 'app:home.admision';
export const clinicalChartPrivilege = 'app:hoja.clinica';
export const clinicalChartVisitsEditPrivilege = 'app:hoja.clinica.visitas.editar';
/** Native OpenMRS capability to record clinical encounters: the line between administrative and clinical staff. */
export const recordEncountersPrivilege = 'Add Encounters';
export const moduleName = '@sihsalus/esm-patient-chart-app';
export const patientChartWorkspaceSlot = 'patient-chart-workspace-slot';
export const patientChartWorkspaceHeaderSlot = 'patient-chart-workspace-header-slot';
export const omrsDateFormat = 'YYYY-MM-DDTHH:mm:ss.SSSZZ';
