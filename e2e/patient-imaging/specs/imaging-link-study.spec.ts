import { expect } from '@playwright/test';
import {
  assignStudy,
  cleanOrthanc,
  deleteStudy,
  getOrthancConfigurations,
  getStudiesByConfig,
  getStudiesByPatient,
  getStudyInstances,
  getStudySeries,
  linkStudies,
  previewInstance,
  uploadStudies,
} from '../commands/imaging-operations';
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

test.describe('ImagingDetailedSummary - Link Study workflow', () => {
  test('DICOM study upload', async ({ page, api, request }) => {
    const orthancConfigurations = await getOrthancConfigurations(api);
    expect(orthancConfigurations.length).toBeGreaterThan(0);
    const orthancConfiguration = orthancConfigurations[0];

    await page.goto(`patient/${patientUuid}/chart/Imaging#`);

    await uploadStudies(request, ['testDicomStudy.zip'], orthancConfiguration);
    await linkStudies(request, orthancConfiguration, 'all');
    const newStudies = await getStudiesByConfig(api, orthancConfiguration, patientUuid);
    expect(newStudies).toHaveLength(1);
  });

  test('DICOM study delete', async ({ page, api, request }) => {
    const orthancConfigurations = await getOrthancConfigurations(api);
    expect(orthancConfigurations.length).toBeGreaterThan(0);
    const orthancConfiguration = orthancConfigurations[0];

    await page.goto(`patient/${patientUuid}/chart/Imaging#`);

    // First sync existing studies (should be 0 because we cleaned the server)
    await linkStudies(request, orthancConfiguration, 'all');
    let studies = await getStudiesByConfig(api, orthancConfiguration, patientUuid);
    expect(studies).toHaveLength(0);

    // If none exist, upload one
    if (studies.length === 0) {
      await uploadStudies(request, ['testDicomStudy.zip'], orthancConfiguration);
      await linkStudies(request, orthancConfiguration, 'all');

      const refreshed = await getStudiesByConfig(api, orthancConfiguration, patientUuid);
      expect(refreshed).toHaveLength(1);

      studies = await getStudiesByConfig(api, orthancConfiguration, patientUuid);
    }

    // If more than one exists, delete down to 1
    if (studies.length > 1) {
      for (let i = 1; i < studies.length; i++) {
        await deleteStudy(api, studies[i].id.toString(), 'orthanc');
      }

      const refreshed = await getStudiesByConfig(api, orthancConfiguration, patientUuid);
      expect(refreshed).toHaveLength(1);

      studies = await getStudiesByConfig(api, orthancConfiguration, patientUuid);
    }

    // At this point, exactly 1 study exists
    expect(studies).toHaveLength(1);

    // Delete the only study
    const studyId = studies[0].id;
    await deleteStudy(api, studyId.toString(), 'orthanc');

    // Verify deletion
    await linkStudies(request, orthancConfiguration, 'all');
    const afterDeleteStudies = await getStudiesByConfig(api, orthancConfiguration, patientUuid);
    expect(afterDeleteStudies).toHaveLength(0);
  });

  test('link a study and display it in the studies table', async ({ page, api, request }) => {
    const orthancConfigurations = await getOrthancConfigurations(api);
    expect(orthancConfigurations.length).toBeGreaterThan(0);
    const orthancConfiguration = orthancConfigurations[0];

    await page.goto(`patient/${patientUuid}/chart/Imaging#`);

    await linkStudies(request, orthancConfiguration, 'all');
    const allStudies = await getStudiesByConfig(api, orthancConfiguration, patientUuid);
    if (allStudies.length === 0) {
      await expect(page.getByText(/No studies found/i).first()).toBeVisible();
    }
    // Fetch all available studies for this patient config
    await uploadStudies(request, ['testDicomStudy.zip'], orthancConfiguration);
    await linkStudies(request, orthancConfiguration, 'all');
    const currentStudies = await getStudiesByConfig(api, orthancConfiguration, patientUuid);
    expect(currentStudies).not.toBeNull();
    expect(currentStudies.length).toBeGreaterThan(0);

    // Pick the new study and assign it to this patient
    const studyToAssign = currentStudies[0];
    await assignStudy(api, studyToAssign.id, patientUuid, true);

    // Assert the study is now linked to the patient
    const studiesAssigned = await getStudiesByPatient(api, patientUuid);
    expect(studiesAssigned.length).toBeGreaterThan(0);
    expect(studiesAssigned[studiesAssigned.length - 1].id).not.toBeNull();
    expect(studiesAssigned[studiesAssigned.length - 1].id).toBe(studyToAssign.id);

    // Verify it shows in the UI
    const lastStudy = studiesAssigned[studiesAssigned.length - 1];

    const studyDescriptionLocator = page.getByText(lastStudy.studyDescription, { exact: false });
    await expect(studyDescriptionLocator).toBeVisible();

    // Similarly for patientName and studyDate
    await expect(page.getByText(lastStudy.patientName, { exact: false })).toBeVisible();
    await expect(page.getByText(lastStudy.studyDate, { exact: false })).toBeVisible();
  });

  test('Unassign the study removed from the table', async ({ api, request }) => {
    const orthancConfigurations = await getOrthancConfigurations(api);
    expect(orthancConfigurations.length).toBeGreaterThan(0);
    const orthancConfiguration = orthancConfigurations[0];

    await linkStudies(request, orthancConfiguration, 'all');
    const currentStudies = await getStudiesByConfig(api, orthancConfiguration, patientUuid);
    if (currentStudies.length < 1) {
      await uploadStudies(request, ['testDicomStudy.zip'], orthancConfiguration);
      await linkStudies(request, orthancConfiguration, 'all');
    }
    const studies = await getStudiesByConfig(api, orthancConfiguration, patientUuid);
    expect(studies.length).toBeGreaterThan(0);

    // First assign the study from the patient and the assigned study removed from UI
    await assignStudy(api, studies[0].id, patientUuid, true);
    // Assert the study is now asigned to the patient
    const studiesAssigned = await getStudiesByPatient(api, patientUuid);
    expect(studiesAssigned).toHaveLength(1);

    // Unassing the patient study
    await assignStudy(api, studiesAssigned[0].id, patientUuid, false);

    const studiesUnAssigned = await getStudiesByPatient(api, patientUuid);
    expect(studiesUnAssigned).toHaveLength(0);
  });

  test('Verify the series and instances of the patient study', async ({ request, page, api }) => {
    const orthancConfigurations = await getOrthancConfigurations(api);
    expect(orthancConfigurations.length).toBeGreaterThan(0);
    const orthancConfiguration = orthancConfigurations[0];

    await linkStudies(request, orthancConfiguration, 'all');
    const allStudies = await getStudiesByConfig(api, orthancConfiguration, patientUuid);
    await page.goto(`patient/${patientUuid}/chart/Imaging#`);

    // Fetch all available studies for this patient config
    await uploadStudies(request, ['testDicomStudy.zip'], orthancConfiguration);
    await linkStudies(request, orthancConfiguration, 'alle');
    const newUploadedStudies = await getStudiesByConfig(api, orthancConfiguration, patientUuid);
    expect(newUploadedStudies).not.toBeNull();
    expect(newUploadedStudies.length).toBeGreaterThan(0);

    // Pick the first study and assign it to this patient
    const studyToAssign = newUploadedStudies[0];
    await assignStudy(api, studyToAssign.id, patientUuid, true);
    await page.reload();

    // Assert the study is now unasigned to the patient
    const studiesAssigned = await getStudiesByPatient(api, patientUuid);
    expect(studiesAssigned.length).toBeGreaterThan(0);

    // Fetch the study series
    const series = await getStudySeries(api, studiesAssigned[0].id);
    expect(series).not.toBeNull();
    expect(series.length).toBeGreaterThan(0);

    // Fetch the instances of the first series
    const firstSeries = series[0];
    const instances = await getStudyInstances(api, studiesAssigned[0].id, firstSeries.seriesInstanceUID);
    expect(instances).toBeDefined();
    expect(instances).not.toBeNull();
    expect(instances.length).toBeGreaterThan(0);

    const studyId = studiesAssigned[0].id;
    await deleteStudy(api, studyId.toString(), 'orthanc');
    await linkStudies(api, orthancConfiguration, 'all');
    const studiesAfterDelete = await getStudiesByConfig(api, orthancConfiguration, patientUuid);
    if (studiesAfterDelete) {
      const deletedStudy = studiesAfterDelete[studyId];
      expect(deletedStudy).not.toBeDefined();
      expect(studiesAfterDelete).toHaveLength(allStudies.length);
    }
  });

  test('Preview an Orthanc instance', async ({ api, page, request }) => {
    const orthancConfigurations = await getOrthancConfigurations(api);
    expect(orthancConfigurations.length).toBeGreaterThan(0);
    const orthancConfiguration = orthancConfigurations[0];

    await page.goto(`patient/${patientUuid}/chart/Imaging#`);

    // Upload new study and link it to openmrs
    await uploadStudies(request, ['testDicomStudy.zip'], orthancConfiguration);
    await linkStudies(request, orthancConfiguration, 'all');
    const newStudies = await getStudiesByConfig(api, orthancConfiguration, patientUuid);
    expect(newStudies).not.toBeNull();
    expect(newStudies.length).toBeGreaterThan(0);

    // Pick the new study and assign it to this patient
    const studyToAssign = newStudies[0];
    await assignStudy(api, studyToAssign.id, patientUuid, true);
    await page.reload();

    // Pick the first series
    const series = await getStudySeries(api, studyToAssign.id);
    expect(series.length).toBeGreaterThan(0);

    let instances: Awaited<ReturnType<typeof getStudyInstances>> = [];
    // pick instance from the series
    let foundValidModality = false;
    for (const s of series) {
      if (s.modality !== 'RTSTRUCT' && s.modality !== 'RTDOSE') {
        instances = await getStudyInstances(api, studyToAssign.id, s.seriesInstanceUID);
        foundValidModality = true;
        break;
      }
    }
    if (!foundValidModality) {
      throw new Error(`Unsupport modality for preview: ${series[0].modality}`);
    }
    expect(instances.length).toBeGreaterThan(0);

    const preview = await previewInstance(api, instances[0].orthancInstanceUID, studyToAssign.id);

    if (/^image\//.test(preview.contentType)) {
      expect(preview.data.length).toBeGreaterThan(100);
    } else if (/^application\/json/.test(preview.contentType)) {
      const json = JSON.parse(preview.data.toString());
      console.warn('No preview available:', json);
      expect(json.error || json.cause).toBeDefined();
    } else {
      throw new Error(`Unexpected content type: ${preview.contentType}`);
    }
  });
});
