import { type FetchResponse, openmrsFetch } from '@openmrs/esm-framework';
import useSWR from 'swr';
import { imagingUrl, maxUploadImageDataSize, worklistUrl } from '../imaging/constants';
import type {
  CreateRequestProcedure,
  CreateRequestProcedureStep,
  DicomStudy,
  Instance,
  OrthancConfiguration,
  RequestProcedure,
  RequestProcedureStep,
  Series,
  StudiesWithScores,
} from '../types';

// Imaging metadata must be fresh after associations/deletions; never replay writes offline.
const fetchImagingData = (url: string) =>
  openmrsFetch(url, {
    cache: 'no-store',
    rejectOnAuthFailure: true,
    headers: { 'x-omrs-offline-caching-strategy': 'network-only-or-cache-only' },
  });

/**
 *
 * @param patientUuid The UUID of the patient whose studies should be fetched.
 */
export function useStudiesByPatient(patientUuid: string) {
  const studiesUrl = `${imagingUrl}/studies?patient=${encodeURIComponent(patientUuid)}`;

  const { data, error, isLoading, isValidating, mutate } = useSWR<{ data: Array<DicomStudy> }, Error>(
    patientUuid ? studiesUrl : null,
    fetchImagingData,
  );

  return {
    data: data?.data,
    error: error,
    isLoading: isLoading,
    isValidating: isValidating,
    mutate,
  };
}

/**
 *
 * @param configuration The configured orthanc server.
 * @param patientUuid The UUID of the patient whose studies should be fetched.
 */
export function useStudiesByConfig(configuration: OrthancConfiguration, patientUuid: string) {
  const studiesByConfigUrl = `${imagingUrl}/studiesbyconfig?configurationId=${configuration.id}&patient=${encodeURIComponent(patientUuid)}`;

  const { data, error, isLoading, isValidating, mutate } = useSWR<FetchResponse<StudiesWithScores>, Error>(
    studiesByConfigUrl,
    fetchImagingData,
  );

  return {
    data: data?.data,
    error: error,
    isLoading: isLoading,
    isValidating: isValidating,
    mutate,
  };
}

function isOrthancConfigurationList(value: unknown): value is OrthancConfiguration[] {
  return (
    Array.isArray(value) &&
    value.every(
      (configuration) =>
        configuration !== null &&
        typeof configuration === 'object' &&
        Number.isInteger(configuration.id) &&
        configuration.id > 0 &&
        typeof configuration.orthancBaseUrl === 'string' &&
        !!configuration.orthancBaseUrl.trim() &&
        (configuration.orthancProxyUrl == null || typeof configuration.orthancProxyUrl === 'string'),
    )
  );
}

/**
 * @returns Get all the orthnac configurations
 */
export function useOrthancConfigurations() {
  const configurationUrl = `${imagingUrl}/configurations`;

  const { data, error, isLoading, isValidating, mutate } = useSWR<FetchResponse<Array<OrthancConfiguration>>, Error>(
    configurationUrl,
    fetchImagingData,
  );

  const configurations = data?.data;
  const hasValidConfigurations = isOrthancConfigurationList(configurations);
  const configurationError =
    data !== undefined && !hasValidConfigurations
      ? new Error('The imaging server configuration response is invalid.')
      : undefined;
  return {
    data: hasValidConfigurations ? configurations : undefined,
    error: error ?? configurationError,
    isLoading,
    isValidating,
    mutate: mutate,
  };
}

/**
 *
 * @param files The DICOM files that should be uploaded to the Orthanc server.
 * @param configuration The Orthanc server to which the DICOM files should be uploaded
 */
export class StudyUploadError extends Error {
  constructor(
    readonly completedFiles: File[],
    readonly failedIndex: number,
    readonly hasUncertainFile = true,
  ) {
    super('The upload result must be checked before retrying the failed file.');
    this.name = 'StudyUploadError';
  }
}

export async function uploadStudies(
  files: File[],
  configuration: OrthancConfiguration,
  patientUuid: string,
  abortController: AbortController,
) {
  if (!patientUuid || !Number.isInteger(configuration.id) || configuration.id <= 0 || files.length === 0) {
    throw new Error('An imaging upload requires a patient, configuration and files.');
  }
  // Imaging 1.2.8 stores a ZIP in Orthanc before failing to associate its studies.
  // Do not advertise or send archives until the backend has an atomic/result contract.
  if (files.some((file) => !/\.dcm$/i.test(file.name) || file.size === 0 || file.size > maxUploadImageDataSize)) {
    throw new Error('Only non-empty DICOM files are supported.');
  }
  const completedFiles: File[] = [];
  for (const [index, file] of files.entries()) {
    if (abortController.signal.aborted) throw new StudyUploadError([...completedFiles], index, false);
    const formData = new FormData();
    formData.append('configurationId', configuration.id.toString());
    formData.append('file', file);
    formData.append('patient', patientUuid);
    try {
      const response = await openmrsFetch<DicomStudy>(`${imagingUrl}/instances`, {
        method: 'POST',
        rejectOnAuthFailure: true,
        signal: abortController.signal,
        body: formData,
      });
      const study = response.data;
      if (
        !response.ok ||
        !study ||
        !Number.isInteger(study.id) ||
        study.id <= 0 ||
        typeof study.studyInstanceUID !== 'string' ||
        !study.studyInstanceUID.trim() ||
        study.mrsPatientUuid !== patientUuid ||
        study.orthancConfiguration?.id !== configuration.id
      ) {
        throw new Error('The uploaded study association was not confirmed.');
      }
      completedFiles.push(file);
    } catch {
      // A failed response can still follow storage in Orthanc. Never retry blindly.
      throw new StudyUploadError([...completedFiles], index);
    }
  }
}

/**
 *
 * @param fetchOption The fetch option should retrieve either all studies or only the most recently updated studies from the Orthanc server
 * @param configuration The orthanc server where the medical studies are stored.
 */
export async function getLinkStudies(
  fetchOption: string,
  configuration: OrthancConfiguration,
  abortController: AbortController,
) {
  const linkUrl = `${imagingUrl}/linkstudies`;

  const formData = new FormData();
  formData.append('configurationId', configuration.id.toString());
  formData.append('fetchOption', fetchOption);

  const response = await openmrsFetch(linkUrl, {
    method: 'POST',
    rejectOnAuthFailure: true,
    signal: abortController.signal,
    body: formData,
  });

  if (!response.ok) {
    throw new Error((await response.text()) || 'Link studies failed');
  }
}

/**
 *
 * @param patientUuid The UUID of the patient whose requests should be fetched
 */
export function useRequestsByPatient(patientUuid: string) {
  const requestsUrl = `${worklistUrl}/patientrequests?patient=${encodeURIComponent(patientUuid)}`;

  const { data, error, isLoading, isValidating, mutate } = useSWR<FetchResponse<Array<RequestProcedure>>, Error>(
    patientUuid ? requestsUrl : null,
    fetchImagingData,
    { refreshInterval: 30000 },
  );

  return {
    data: data?.data,
    error: error,
    isLoading: isLoading,
    isValidating: isValidating,
    mutate: mutate,
  };
}

export function useRequestProcedures(status: string) {
  const procedureUrl = `${worklistUrl}/requests?status=${status}`;

  const { data, error, isLoading, isValidating, mutate } = useSWR<FetchResponse<Array<RequestProcedure>>, Error>(
    status ? procedureUrl : null,
    fetchImagingData,
    { refreshInterval: 3000 },
  );
  return {
    data: data?.data,
    error: error,
    isLoading: isLoading,
    isValidating: isValidating,
    mutate: mutate,
  };
}

/**
 *
 * @param requestId The UID of the requested procedure whose step should be fetched
 */
export function useProcedureStep(requestId: number) {
  const procedureStepUrl = `${worklistUrl}/requeststep?requestId=${requestId}`;

  const { data, error, isLoading, isValidating, mutate } = useSWR<FetchResponse<Array<RequestProcedureStep>>, Error>(
    procedureStepUrl,
    fetchImagingData,
    { refreshInterval: 30000 },
  );

  return {
    data: data?.data,
    error: error,
    isLoading: isLoading,
    isValidating: isValidating,
    mutate: mutate,
  };
}

/**
 *
 * @param studyId The medical study series that should be retrieved.
 */
export function useStudySeries(studyId: number) {
  const seriesUrl = `${imagingUrl}/studyseries?studyId=${studyId}`;

  const { data, error, isLoading, isValidating, mutate } = useSWR<FetchResponse<Array<Series>>, Error>(
    seriesUrl,
    fetchImagingData,
  );

  return {
    data: data?.data,
    error,
    isLoading,
    isValidating,
    mutate: mutate,
  };
}

/**
 *
 * @param studyId The medical study instances that should be retrieved.
 * @param seriesInstanceUID The UID of the series of the medical studies
 */
export function useStudyInstances(studyId: number, seriesInstanceUID: string) {
  const instancesUrl = `${imagingUrl}/studyinstances?studyId=${studyId}&seriesInstanceUID=${encodeURIComponent(seriesInstanceUID)}`;

  const { data, error, isLoading, isValidating, mutate } = useSWR<FetchResponse<Array<Instance>>, Error>(
    instancesUrl,
    fetchImagingData,
  );

  return {
    data: data?.data,
    error,
    isLoading,
    isValidating,
    mutate: mutate,
  };
}

/**
 *
 * @param studyId The medical study that should be assigned to the patient.
 * @param patientUuid The UUID of the patient to whom the study belongs.
 * @param isAssign Is the study assigned to the patient?
 */
export async function assignStudy(
  studyId: number,
  patientUuid: string,
  isAssign: boolean,
  abortController: AbortController,
) {
  const mappingUrl = `${imagingUrl}/assingstudy`;

  const formData = new FormData();
  formData.append('studyId', studyId.toString());
  formData.append('patient', patientUuid);
  formData.append('isAssign', isAssign.toString());

  const response = await openmrsFetch(mappingUrl, {
    method: 'POST',
    rejectOnAuthFailure: true,
    signal: abortController.signal,
    body: formData,
  });

  if (!response.ok) {
    throw new Error((await response.text()) || 'Save requested procedure failed');
  }
}

/**
 *
 * @param request The new requested procedure should be stored.
 * @param patientUuid The UUID of the patient to whom the request belongs
 */
export async function saveRequestProcedure(
  request: CreateRequestProcedure,
  patientUuid: string,
  abortController: AbortController,
) {
  const saveRequstUrl = `${worklistUrl}/saverequest`;

  const requestPostData = {
    configurationId: request.orthancConfiguration.id,
    patientUuid: patientUuid,
    accessionNumber: request.accessionNumber,
    requestingPhysician: request.requestingPhysician,
    requestDescription: request.requestDescription,
    priority: request.priority,
  };

  const response = await openmrsFetch(saveRequstUrl, {
    method: 'POST',
    rejectOnAuthFailure: true,
    headers: {
      'Content-Type': 'application/json',
    },
    signal: abortController.signal,
    body: JSON.stringify(requestPostData),
  });

  if (!response.ok) {
    throw new Error((await response.text()) || 'Save requested procedure failed');
  }
}

/**
 *
 * @param step The new procedure step should be add to the requested procedure
 * @param requestId The UID of the requested procedure should be updated to include the new step.
 */
export async function saveRequestProcedureStep(
  step: CreateRequestProcedureStep,
  requestId: number,
  abortController: AbortController,
) {
  const saveProcedureStepUrl = `${worklistUrl}/savestep`;

  const stepPostData = {
    requestId: requestId,
    modality: step.modality,
    aetTitle: step.aetTitle,
    scheduledReferringPhysician: step.scheduledReferringPhysician,
    requestedProcedureDescription: step.requestedProcedureDescription,
    stepStartDate: step.stepStartDate,
    stepStartTime: step.stepStartTime,
    stationName: step.stationName,
    procedureStepLocation: step.procedureStepLocation,
  };

  const response = await openmrsFetch(saveProcedureStepUrl, {
    method: 'POST',
    rejectOnAuthFailure: true,
    headers: {
      'Content-Type': 'application/json',
    },
    signal: abortController.signal,
    body: JSON.stringify(stepPostData),
  });

  if (!response.ok) {
    throw new Error((await response.text()) || 'Save requested procedure step failed');
  }
}

/**
 *
 * @param studyId The medical study should be deleted
 * @param deleteOption The delete option should allow the user to choose whether to delete data only from OpenMRS
 *                     or from both OpenMRS and the Orthanc server.
 */
export function deleteStudy(studyId: number, deleteOption: string, abortController: AbortController) {
  return openmrsFetch(`${imagingUrl}/study?studyId=${studyId}&deleteOption=${deleteOption}`, {
    method: 'DELETE',
    rejectOnAuthFailure: true,
    signal: abortController.signal,
  });
}

/**
 *
 * @param orthancSeriesUID
 * @param studyId
 * @param abortController
 * @returns
 */
export function deleteSeries(orthancSeriesUID: string, studyId: number, abortController: AbortController) {
  return openmrsFetch(
    `${imagingUrl}/series?orthancSeriesUID=${encodeURIComponent(orthancSeriesUID)}&studyId=${studyId}`,
    {
      method: 'DELETE',
      rejectOnAuthFailure: true,
      signal: abortController.signal,
    },
  );
}

/**
 *
 * @param requestId The requested procedure should be deleted
 */
export function deleteRequest(requestId: number, abortController: AbortController) {
  return openmrsFetch(`${worklistUrl}/request?requestId=${requestId}`, {
    method: 'DELETE',
    rejectOnAuthFailure: true,
    signal: abortController.signal,
  });
}

/**
 *
 * @param stepId The procedure step should be deleted
 */
export function deleteProcedureStep(stepId: number, abortController: AbortController) {
  return openmrsFetch(`${worklistUrl}/requeststep?stepId=${stepId}`, {
    method: 'DELETE',
    rejectOnAuthFailure: true,
    signal: abortController.signal,
  });
}

/**
 *
 * @param orthancInstanceUID The orthanc server where the study is stored
 * @param studyId The UID of the medical study for which instances should be previewed.
 */
export function previewInstance(orthancInstanceUID: string, studyId: number, abortController: AbortController) {
  const previewUrl = `${imagingUrl}/previewinstance?orthancInstanceUID=${encodeURIComponent(orthancInstanceUID)}&studyId=${studyId}`;
  return openmrsFetch(previewUrl, {
    method: 'GET',
    rejectOnAuthFailure: true,
    cache: 'no-store',
    headers: { Accept: 'image/png' },
    signal: abortController.signal,
  });
}

/**
 *
 * @param status The new status that should be set for the procedure step.
 * @param stepId The UID of the procedure step whose status should be updated.
 */
export async function updateProcedureStepStatus(status: string, stepId: number, abortController: AbortController) {
  const updateStepStatusUrl = `${worklistUrl}/updateprocedurestepstatus`;
  const formData = new FormData();
  formData.append('status', status);
  formData.append('stepId', stepId.toString());

  const response = await openmrsFetch(updateStepStatusUrl, {
    method: 'POST',
    rejectOnAuthFailure: true,
    signal: abortController.signal,
    body: formData,
  });

  if (!response.ok) {
    throw new Error((await response.text()) || 'Update procedure step status failed');
  }
}

/**
 *
 * @param linkStatus The new link status that should be set for the study.
 * @param studyId The UID of the study whose link status should be updated.
 */
export async function updateStudyLinkStatus(linkStatus: number, studyId: number, abortController: AbortController) {
  const updateLinkingUrl = `${imagingUrl}/updatestudyLinkStatus`;
  const formData = new FormData();
  formData.append('studyId', studyId.toString());
  formData.append('linkStatus', linkStatus.toString());

  const response = await openmrsFetch(updateLinkingUrl, {
    method: 'POST',
    rejectOnAuthFailure: true,
    signal: abortController.signal,
    body: formData,
  });

  if (!response.ok) {
    throw new Error((await response.text()) || 'Update study linking status failed');
  }
}
