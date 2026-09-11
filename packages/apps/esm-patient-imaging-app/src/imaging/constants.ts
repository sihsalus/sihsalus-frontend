import { restBaseUrl } from '@openmrs/esm-framework';

export const imagingEditPrivilege = 'app:hoja.clinica.imagenes.editar';

export const uploadStudiesFormWorkspace = 'upload-studies-form-workspace';
export const linkStudiesFormWorkspace = 'link-studies-form-workspace';
export const assignStudiesFormWorkspace = 'assign-studies-form-workspace';
export const addNewRequestWorkspace = 'add-request-form-workspace';
export const addNewProcedureStepWorkspace = 'add-procedureStep-form-workspace';
export const studyDeleteConfirmationDialog = 'study-delete-confirmation-dialog';
export const seriesDeleteConfirmationDialog = 'series-delete-confirmation-dialog';
export const requestDeleteConfirmationDialog = 'request-delete-confirmation-dialog';
export const procedureSteptDeleteConfirmationDialog = 'procedureStep-delete-confirmation-dialog';
export const instancePreviewDialog = 'instance-preview-dialog';
export const studiesCount = 5;
export const seriesCount = 5;
export const instancesCount = 10;
export const requestCount = 5;
export const procedureStepCount = 5;
export const maxUploadImageDataSize = 200000000; // 200MB

export const imagingUrl = restBaseUrl + '/imaging';
export const worklistUrl = restBaseUrl + '/worklist';
