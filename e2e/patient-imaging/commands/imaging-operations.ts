// tests/helpers/imaging-operations.ts
import { type APIRequestContext, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import type {
  CreateRequestProcedure,
  CreateRequestProcedureStep,
  DicomStudy,
  Instance,
  OrthancConfiguration,
  RequestProcedure,
  RequestProcedureStep,
  Series,
} from '../../src/types';

const imagingUrl = '/openmrs/ws/rest/v1/imaging';
const worklistUrl = '/openmrs/ws/rest/v1/worklist';

/**
 * Delete a study
 */
export const deleteStudy = async (api: APIRequestContext, studyId: string, deleteOption: 'openmrs' | 'orthanc') => {
  const res = await api.delete(`${imagingUrl}/study?studyId=${studyId}&deleteOption=${deleteOption}`);
  expect(res.ok()).toBeTruthy();
};

export const getStudiesByConfig = async (
  api: APIRequestContext,
  configuration: OrthancConfiguration,
  patientUuid: string,
): Promise<DicomStudy[]> => {
  const res = await api.get(`${imagingUrl}/studiesbyconfig?configurationId=${configuration.id}&patient=${patientUuid}`);
  expect(res.ok()).toBeTruthy();

  const json = await res.json();
  return json.studies ?? [];
};

/**
 * Create a request
 */
export const createRequest = async (api: APIRequestContext, request: CreateRequestProcedure): Promise<void> => {
  const res = await api.post(`${worklistUrl}/saverequest`, {
    data: {
      patientUuid: request.patientUuid,
      configurationId: request.orthancConfiguration.id,
      accessionNumber: request.accessionNumber,
      requestingPhysician: request.requestingPhysician,
      requestDescription: request.requestDescription,
      priority: request.priority,
    },
    headers: { 'Content-Type': 'application/json' },
  });
  expect(res.ok()).toBeTruthy();
};

/**
 * Delete a request
 */
export const deleteRequest = async (api: APIRequestContext, requestId: number) => {
  const res = await api.delete(`${worklistUrl}/request?requestId=${requestId}`);
  expect(res.ok()).toBeTruthy();
};

/**
 * Create a procedure step
 */
export const createProcedureStep = async (
  api: APIRequestContext,
  requestId: number,
  step: CreateRequestProcedureStep,
): Promise<void> => {
  const res = await api.post(`${worklistUrl}/savestep`, {
    data: {
      requestId: requestId,
      modality: step.modality,
      aetTitle: step.aetTitle,
      scheduledReferringPhysician: step.scheduledReferringPhysician,
      requestedProcedureDescription: step.requestedProcedureDescription,
      stepStartDate: step.stepStartDate,
      stepStartTime: step.stepStartTime,
      stationName: step.stationName,
      procedureStepLocation: step.procedureStepLocation,
    },
    headers: { 'Content-Type': 'application/json' },
  });
  expect(res.ok()).toBeTruthy();
};

/**
 * Delete a procedure step
 */
export const deleteProcedureStep = async (api: APIRequestContext, stepId: string) => {
  const res = await api.delete(`${worklistUrl}/requeststep?stepId=${stepId}`);
  expect(res.ok()).toBeTruthy();
};

/**
 * Assign/unassign a study
 */
export const assignStudy = async (api: APIRequestContext, studyId: number, patientUuid: string, isAssign: boolean) => {
  const formData = new FormData();
  formData.append('studyId', studyId.toString());
  formData.append('patient', patientUuid);
  formData.append('isAssign', isAssign.toString());

  const res = await api.post(`${imagingUrl}/assingstudy`, {
    form: formData,
  });

  expect(res.ok()).toBeTruthy();
};

/**
 * Link studies from Orthanc
 */
export const linkStudies = async (api: APIRequestContext, configuration: OrthancConfiguration, fetchOption: string) => {
  const res = await api.post(`${imagingUrl}/linkstudies`, {
    form: {
      configurationId: configuration.id.toString(),
      fetchOption,
    },
  });
  expect(res.ok()).toBeTruthy();
};

/**
 * Upload a study file
 */
export const uploadStudyFile = async (api: APIRequestContext, file: File, configuration: OrthancConfiguration) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('configurationId', configuration.id.toString());

  const res = await api.post(`${imagingUrl}/instances`, { data: formData });
  expect(res.ok()).toBeTruthy();
};

/**
 * Fetch studies by patient
 */
export const getStudiesByPatient = async (api: APIRequestContext, patientUuid: string): Promise<DicomStudy[]> => {
  const res = await api.get(`${imagingUrl}/studies?patient=${patientUuid}`);
  expect(res.ok()).toBeTruthy();

  return await res.json();
};

/**
 * Fetch requests by patient
 */
export const getRequestsByPatient = async (
  api: APIRequestContext,
  patientUuid: string,
): Promise<RequestProcedure[]> => {
  const res = await api.get(`${worklistUrl}/patientrequests?patient=${patientUuid}`);
  expect(res.ok()).toBeTruthy();
  return await res.json();
};

/**
 * Fetch procedure steps
 */
export const getProcedureSteps = async (api: APIRequestContext, requestId: number): Promise<RequestProcedureStep[]> => {
  const res = await api.get(`${worklistUrl}/requeststep?&requestId=${requestId}`);
  expect(res.ok()).toBeTruthy();
  return await res.json();
};

/**
 * Fetch series for a study
 */
export const getStudySeries = async (api: APIRequestContext, studyId: number): Promise<Series[]> => {
  const res = await api.get(`${imagingUrl}/studyseries?studyId=${studyId}`);
  expect(res.ok()).toBeTruthy();
  return await res.json();
};

/**
 * Fetch instances for a study series
 */
export const getStudyInstances = async (
  api: APIRequestContext,
  studyId: number,
  seriesInstanceUID: string,
): Promise<Instance[]> => {
  const res = await api.get(`${imagingUrl}/studyinstances?studyId=${studyId}&seriesInstanceUID=${seriesInstanceUID}`);
  expect(res.ok()).toBeTruthy();
  return await res.json();
};

/**
 * Preview an instance
 */
export const previewInstance = async (api: APIRequestContext, orthancInstanceUID: string, studyId: number) => {
  const res = await api.get(
    `${imagingUrl}/previewinstance?orthancInstanceUID=${orthancInstanceUID}&studyId=${studyId}`,
  );

  expect(res.ok()).toBeTruthy();

  const buffer = Buffer.from(await res.body());

  return {
    data: buffer,
    contentType: res.headers()['content-type'],
  };
};

/**
 * Upload dicom study to the Orthanc server
 */
export const uploadStudies = async (
  api: APIRequestContext,
  filesNames: string[],
  orthancConfig: OrthancConfiguration,
): Promise<void> => {
  const uploadUrl = `${imagingUrl}/instances`;
  for (const fileName of filesNames) {
    const filePath = path.resolve(__dirname, '../../test-utils/mocks', fileName);
    const fileBuffer = fs.readFileSync(filePath);

    const multipart = {
      configurationId: orthancConfig.id.toString(),
      file: {
        name: fileName,
        mimeType: 'application/dicom',
        buffer: Buffer.isBuffer(fileBuffer) ? fileBuffer : Buffer.from(fileBuffer),
      },
    };

    const res = await api.post(uploadUrl, { multipart });
    if (!res.ok()) {
      const body = await res.text();
      throw new Error(`Upload failed: ${body}`);
    }
    expect(res.ok()).toBeTruthy();
  }
};

/**
 * Get configured orthanc servers
 */
export const getOrthancConfigurations = async (api: APIRequestContext): Promise<OrthancConfiguration[]> => {
  const res = await api.get(`${imagingUrl}/configurations`);
  expect(res.ok()).toBeTruthy();
  return await res.json();
};

// Delete all studies in openmrs database and all orthanc servers, so there are
// no old studies that don't exist anymore in orthanc
export async function cleanOrthanc(request, api, patientUuid) {
  const orthancConfigurations = await getOrthancConfigurations(api);
  expect(orthancConfigurations.length).toBeGreaterThan(0);

  if (patientUuid) {
    for (const config of orthancConfigurations) {
      await linkStudies(request, config, 'all');
      const studies = await getStudiesByConfig(api, config, patientUuid);
      for (const study of studies) {
        await deleteStudy(api, study.id.toString(), 'orthanc');
      }

      await expect
        .poll(
          async () => {
            await linkStudies(request, config, 'all');
            const remaining = await getStudiesByConfig(api, config, patientUuid);
            return remaining.length;
          },
          { timeout: 20_000 },
        )
        .toBe(0);
    }
  }
}
