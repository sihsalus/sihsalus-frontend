import { expect } from '@playwright/test';
import {
  cleanOrthanc,
  createProcedureStep,
  createRequest,
  deleteProcedureStep,
  deleteRequest,
  getOrthancConfigurations,
  getProcedureSteps,
  getRequestsByPatient,
} from '../commands/imaging-operations';
import type { CreateRequestProcedure, CreateRequestProcedureStep, RequestProcedure } from '../commands/types';
import { test } from '../core';

let patientUuid: string;

test.beforeEach(async ({ api, patient, request }) => {
  patientUuid = patient.uuid;
  await cleanOrthanc(request, api, patientUuid);
});

test.afterEach(async ({ api, request }) => {
  await cleanOrthanc(request, api, patientUuid);
});

test.afterAll(async ({ api, request }) => {
  await cleanOrthanc(request, api, patientUuid);
});

test.describe.configure({ mode: 'serial' });

test.describe('ImagingWorklist - Manager worklist workflow', () => {
  test('Create and delete a request procedure', async ({ page, api }) => {
    const orthancConfigurations = await getOrthancConfigurations(api);
    expect(orthancConfigurations.length).toBeGreaterThan(0);
    const orthancConfiguration = orthancConfigurations[0];

    // Define a request payload
    const requestPayload: CreateRequestProcedure = {
      orthancConfiguration: orthancConfiguration,
      patientUuid: patientUuid,
      accessionNumber: `ACC-${Date.now()}`, // unique accession number
      requestingPhysician: 'Dr. Test',
      requestDescription: 'CT Chest for automation test',
      priority: 'medium',
    };

    // Create request
    await createRequest(api, requestPayload);
    await page.reload();

    const requestsBeforeDelete = await getRequestsByPatient(api, patientUuid);
    const createdRequest = requestsBeforeDelete.find((r) => r.accessionNumber === requestPayload.accessionNumber);
    expect(createdRequest).toBeDefined();
    expect(createdRequest['mrsPatientUuid']).toBe(patientUuid);

    await deleteRequest(api, createdRequest!.id);

    // Verify request is visible for this patient
    const requestsAfterDelete: RequestProcedure[] = await getRequestsByPatient(api, patientUuid);
    const deletedRequest = requestsAfterDelete.find((r) => r.id === createdRequest!.id);
    expect(deletedRequest).toBeUndefined();

    const reqs = await getRequestsByPatient(api, patientUuid);
    expect(reqs).toHaveLength(0);
  });

  test('Create and delete the steps for the request procedure', async ({ page, api }) => {
    const orthancConfigurations = await getOrthancConfigurations(api);
    expect(orthancConfigurations.length).toBeGreaterThan(0);
    const orthancConfiguration = orthancConfigurations[0];

    // Create request
    const requestPayload: CreateRequestProcedure = {
      orthancConfiguration: orthancConfiguration,
      patientUuid: patientUuid,
      accessionNumber: `ACC-${Date.now()}`, // unique accession number
      requestingPhysician: 'Dr. Test',
      requestDescription: 'CT Chest for automation test',
      priority: 'medium',
    };

    await createRequest(api, requestPayload);

    const requests = await getRequestsByPatient(api, patientUuid);
    const createdRequest = requests.find((r) => r.accessionNumber === requestPayload.accessionNumber);

    expect(createdRequest).toBeDefined();
    expect(createdRequest!.id).toBeGreaterThan(0);

    // Create procedure step
    const stepPayload1: CreateRequestProcedureStep = {
      requestId: createdRequest!.id,
      modality: 'CT',
      aetTitle: 'TEST_AET',
      scheduledReferringPhysician: 'Dr. Scheduler',
      requestedProcedureDescription: 'Abdomen CT scan step',
      stepStartDate: `${Date.now()}`,
      stepStartTime: '10:30',
      stationName: 'Station-1',
      procedureStepLocation: 'Room-101',
    };
    await createProcedureStep(api, createdRequest.id, stepPayload1);

    const stepPayload2: CreateRequestProcedureStep = {
      requestId: createdRequest!.id,
      modality: 'MRI',
      aetTitle: 'TEST_AET',
      scheduledReferringPhysician: 'Dr. Scheduler',
      requestedProcedureDescription: 'Abdomen MRI scan step',
      stepStartDate: `${Date.now()}`, // use today's date or dynamic
      stepStartTime: '10:30',
      stationName: 'Station-2',
      procedureStepLocation: 'Room-101',
    };
    await createProcedureStep(api, createdRequest.id, stepPayload2);

    // verify the steps
    const steps = await getProcedureSteps(api, createdRequest.id);
    expect(steps.length).toBeGreaterThan(1), expect(steps[0].requestProcedureId).toBe(createdRequest.id);
    expect(steps[0].modality).toBe('CT');
    expect(steps[0].stationName).toBe('Station-1');

    expect(steps[1].requestProcedureId).toBe(createdRequest.id);
    expect(steps[1].modality).toBe('MRI');
    expect(steps[1].stationName).toBe('Station-2');

    await deleteProcedureStep(api, steps[0].id.toString());
    const stepsAfterDelete = await getProcedureSteps(api, createdRequest.id);
    expect(stepsAfterDelete).toHaveLength(1), expect(stepsAfterDelete[0]).toBeDefined();
    expect(stepsAfterDelete[0].modality).toBe('MRI');

    await deleteRequest(api, createdRequest.id);
    const reqs = await getRequestsByPatient(api, patientUuid);
    expect(reqs).toHaveLength(0);
  });
});
