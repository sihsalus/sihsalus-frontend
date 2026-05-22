import { getDefaultsFromConfigSchema, useConfig, useWorkspaces, type WorkspacesInfo } from '@openmrs/esm-framework';
import { launchPatientWorkspace } from '@openmrs/esm-patient-common-lib';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import {
  formattedVitals,
  getByTextWithMarkup,
  mockConceptMetadata,
  mockConceptUnits,
  mockCurrentVisit,
  mockFhirPatient,
  mockPatient,
  mockVitalsConfig,
  renderWithSwr,
  waitForLoadingToFinish,
} from 'test-utils';

import { invalidateCachedVitalsAndBiometrics, useVitalsAndBiometrics } from '../common';
import { type ConfigObject, configSchema } from '../config-schema';
import { patientVitalsBiometricsFormWorkspace } from '../constants';

import VitalsHeader from './vitals-header.component';

dayjs.extend(utc);

const testProps = {
  patientUuid: mockPatient.id,
  showRecordVitalsButton: true,
};

const mockUseConfig = vi.mocked(useConfig<ConfigObject>);
const mockLaunchPatientWorkspace = vi.mocked(launchPatientWorkspace);
const mockUseVitalsAndBiometrics = vi.mocked(useVitalsAndBiometrics);
const mockUseWorkspaces = vi.mocked(useWorkspaces);

mockUseWorkspaces.mockReturnValue({ workspaces: [] } as WorkspacesInfo);

vi.mock('@openmrs/esm-patient-common-lib', async () => {
  const originalModule = await vi.importActual('@openmrs/esm-patient-common-lib');

  return {
    ...originalModule,
    launchPatientWorkspace: vi.fn(),
    useVisitOrOfflineVisit: vi.fn().mockImplementation(() => ({ currentVisit: mockCurrentVisit })),
  };
});

vi.mock('../common', async () => {
  const originalModule = await vi.importActual('../common');

  return {
    ...originalModule,
    useVitalsConceptMetadata: vi.fn().mockImplementation(() => ({
      data: mockConceptUnits,
      conceptMetadata: mockConceptMetadata,
      isLoading: false,
    })),
    useVitalsAndBiometrics: vi.fn(),
  };
});

mockUseConfig.mockReturnValue({
  ...getDefaultsFromConfigSchema(configSchema),
  ...mockVitalsConfig,
} as ConfigObject);

describe('VitalsHeader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseWorkspaces.mockReturnValue({ workspaces: [] } as WorkspacesInfo);
    mockUseConfig.mockReturnValue({
      ...getDefaultsFromConfigSchema(configSchema),
      ...mockVitalsConfig,
    } as ConfigObject);
    mockUseVitalsAndBiometrics.mockReturnValue({
      data: formattedVitals,
    } as ReturnType<typeof useVitalsAndBiometrics>);
  });

  it('renders an empty state view when there are no vitals data to show', async () => {
    mockUseVitalsAndBiometrics.mockReturnValue({
      data: [],
    } as ReturnType<typeof useVitalsAndBiometrics>);

    renderWithSwr(<VitalsHeader {...testProps} />);

    await waitForLoadingToFinish();

    expect(screen.getByText(/vitals and biometrics/i)).toBeInTheDocument();
    expect(screen.getByText(/no data has been recorded for this patient/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /record vitals/i })).toBeInTheDocument();
  });

  it('renders the most recently recorded values in the vitals header', async () => {
    mockUseVitalsAndBiometrics.mockReturnValue({
      data: formattedVitals,
    } as ReturnType<typeof useVitalsAndBiometrics>);

    renderWithSwr(<VitalsHeader {...testProps} />);

    await waitForLoadingToFinish();

    expect(screen.getByText(/vitals and biometrics/i)).toBeInTheDocument();
    const expectedRecordedDate = dayjs.utc(formattedVitals[0].date).local().format('DD-MMM-YYYY');
    expect(screen.getByText(new RegExp(expectedRecordedDate, 'i'))).toBeInTheDocument();
    expect(screen.getByText(/vitals history/i)).toBeInTheDocument();
    expect(screen.getByText(/record vitals/i)).toBeInTheDocument();

    expect(getByTextWithMarkup(/BP\s*121 \/ 89\s*mmHg/i)).toBeInTheDocument();
    expect(getByTextWithMarkup(/Temp\s*37\s*DEG C/i)).toBeInTheDocument();
    expect(getByTextWithMarkup(/Heart rate\s*76\s*beats\/min/i)).toBeInTheDocument();
    expect(getByTextWithMarkup(/SpO2\s*-\s*/i)).toBeInTheDocument();
    expect(getByTextWithMarkup(/R\. Rate\s*12\s*breaths\/min/i)).toBeInTheDocument();
    expect(getByTextWithMarkup(/Height\s*-\s*/i)).toBeInTheDocument();
    expect(getByTextWithMarkup(/BMI\s*-\s*/i)).toBeInTheDocument();
    expect(getByTextWithMarkup(/Weight\s*-\s*/i)).toBeInTheDocument();
    expect(getByTextWithMarkup(/MUAC\s*23\s*cm/i)).toBeInTheDocument();
    expect(getByTextWithMarkup(/these vitals are out of date/i)).toBeInTheDocument();
  });

  it('launches the vitals form when the `record vitals` button is clicked', async () => {
    const user = userEvent.setup();

    renderWithSwr(<VitalsHeader {...testProps} />);

    await waitForLoadingToFinish();

    const recordVitalsButton = screen.getByText(/Record vitals/i);

    await user.click(recordVitalsButton);

    expect(mockLaunchPatientWorkspace).toHaveBeenCalledTimes(1);
    expect(mockLaunchPatientWorkspace).toHaveBeenCalledWith(patientVitalsBiometricsFormWorkspace);
  });

  it('displays correct overdue tag for vitals 5 days old', async () => {
    const fiveDaysAgo = dayjs().subtract(5, 'days').toISOString();
    const vitalsData = [
      {
        ...formattedVitals[0],
        date: fiveDaysAgo,
      },
    ];

    mockUseVitalsAndBiometrics.mockReturnValue({
      data: vitalsData,
    } as ReturnType<typeof useVitalsAndBiometrics>);

    renderWithSwr(<VitalsHeader {...testProps} />);

    await waitForLoadingToFinish();

    // TODO: Fix pluralization so that the string reads "5 days old"
    expect(getByTextWithMarkup(/These vitals are 5 day old/i)).toBeInTheDocument();
  });

  it('does not flag normal values that lie within the provided reference ranges', async () => {
    const normalVitals = [
      {
        id: 'normal-vitals',
        date: '2022-05-19T00:00:00.000Z',
        systolic: 120,
        diastolic: 80,
        bloodPressureRenderInterpretation: 'normal',
        pulse: 76,
        spo2: 98,
        temperature: 37,
        respiratoryRate: 16,
      },
    ];

    mockUseVitalsAndBiometrics.mockReturnValue({
      data: normalVitals,
    } as ReturnType<typeof useVitalsAndBiometrics>);

    renderWithSwr(<VitalsHeader {...testProps} />);

    await waitForLoadingToFinish();

    expect(screen.queryByTitle(/abnormal value/i)).not.toBeInTheDocument();
  });

  it('flags abnormal values that lie outside of the provided reference ranges', async () => {
    const abnormalVitals = [
      {
        id: '6f4ed885-2bc1-4ed4-92e5-3dddb9180f30',
        date: '2022-05-19T00:00:00.000Z',
        systolic: 165,
        diastolic: 150,
        bloodPressureRenderInterpretation: 'critically_high',
        pulse: 76,
        spo2: undefined,
        temperature: 37,
        respiratoryRate: 12,
      },
    ];

    mockUseVitalsAndBiometrics.mockReturnValue({
      data: abnormalVitals,
    } as ReturnType<typeof useVitalsAndBiometrics>);

    renderWithSwr(<VitalsHeader {...testProps} />);

    await waitForLoadingToFinish();

    expect(screen.getByTitle(/abnormal value/i)).toBeInTheDocument();
  });

  it('should launch Form Entry vitals and biometrics form', async () => {
    const user = userEvent.setup();

    mockUseConfig.mockReturnValue({
      ...(getDefaultsFromConfigSchema(configSchema) as Record<string, unknown>),
      vitals: {
        ...mockVitalsConfig.vitals,
        useFormEngine: true,
        formName: 'Triage',
      },
    } as unknown as ConfigObject);

    renderWithSwr(<VitalsHeader {...testProps} />);

    await waitForLoadingToFinish();

    const recordVitalsButton = screen.getByText(/Record vitals/i);

    await user.click(recordVitalsButton);

    expect(mockLaunchPatientWorkspace).toHaveBeenCalledWith('patient-form-entry-workspace', {
      formInfo: {
        encounterUuid: '',
        formUuid: '9f26aad4-244a-46ca-be49-1196df1a8c9a',
      },
      workspaceTitle: 'Triage',
      mutateForm: invalidateCachedVitalsAndBiometrics,
    });
  });

  it('should launch configured Form Entry workspace for vitals and biometrics', async () => {
    const user = userEvent.setup();

    mockUseConfig.mockReturnValue({
      ...(getDefaultsFromConfigSchema(configSchema) as Record<string, unknown>),
      vitals: {
        ...mockVitalsConfig.vitals,
        useFormEngine: true,
        formName: 'Ward vitals',
        formEntryWorkspaceName: 'ward-patient-form-entry-workspace',
      },
    } as unknown as ConfigObject);

    renderWithSwr(<VitalsHeader {...testProps} />);

    await waitForLoadingToFinish();

    await user.click(screen.getByText(/Record vitals/i));

    expect(mockLaunchPatientWorkspace).toHaveBeenCalledWith('ward-patient-form-entry-workspace', {
      formInfo: {
        encounterUuid: '',
        formUuid: '9f26aad4-244a-46ca-be49-1196df1a8c9a',
      },
      workspaceTitle: 'Ward vitals',
      mutateForm: invalidateCachedVitalsAndBiometrics,
    });
  });

  it('uses custom vitals form launcher when provided by a workspace host', async () => {
    const user = userEvent.setup();
    const launchCustomVitalsForm = vi.fn();

    renderWithSwr(<VitalsHeader {...testProps} launchCustomVitalsForm={launchCustomVitalsForm} />);

    await waitForLoadingToFinish();

    await user.click(screen.getByText(/Record vitals/i));

    expect(launchCustomVitalsForm).toHaveBeenCalledTimes(1);
    expect(mockLaunchPatientWorkspace).not.toHaveBeenCalled();
  });

  it('should show links in vitals header by default', async () => {
    const fiveDaysAgo = dayjs().subtract(5, 'days').toISOString();
    const vitalsData = [
      {
        ...formattedVitals[0],
        date: fiveDaysAgo,
      },
    ];

    mockUseVitalsAndBiometrics.mockReturnValue({
      data: vitalsData,
    } as ReturnType<typeof useVitalsAndBiometrics>);
    renderWithSwr(<VitalsHeader {...testProps} />);

    await waitForLoadingToFinish();

    expect(screen.getByRole('link', { name: /vitals history/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^record vitals$/i })).toBeInTheDocument();
  });

  it('should show not links in vitals header when hideLinks is true', async () => {
    const fiveDaysAgo = dayjs().subtract(5, 'days').toISOString();
    const vitalsData = [
      {
        ...formattedVitals[0],
        date: fiveDaysAgo,
      },
    ];

    mockUseVitalsAndBiometrics.mockReturnValue({
      data: vitalsData,
    } as ReturnType<typeof useVitalsAndBiometrics>);
    renderWithSwr(<VitalsHeader {...{ ...testProps, hideLinks: true }} />);

    await waitForLoadingToFinish();

    expect(screen.queryByRole('link', { name: /vitals history/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /record vitals/i })).not.toBeInTheDocument();
  });

  it('displays correct overdue tag for vitals less than 1 day old', async () => {
    mockUseConfig.mockReturnValue({
      ...getDefaultsFromConfigSchema(configSchema),
      ...mockVitalsConfig,
      vitals: { ...mockVitalsConfig.vitals, vitalsOverdueThresholdHours: 1 },
    } as ConfigObject);

    const twoHoursAgo = dayjs().subtract(2, 'hours').toISOString();
    mockUseVitalsAndBiometrics.mockReturnValue({
      data: [{ ...formattedVitals[0], date: twoHoursAgo }],
    } as ReturnType<typeof useVitalsAndBiometrics>);

    renderWithSwr(<VitalsHeader {...testProps} visitContext={mockCurrentVisit} />);
    await waitForLoadingToFinish();

    expect(getByTextWithMarkup(/These vitals are 2 hour/i)).toBeInTheDocument();
  });

  it('hides BMI in vitals header when bmiMinimumAge is set and patient is under minimum age', async () => {
    mockUseConfig.mockReturnValue({
      ...getDefaultsFromConfigSchema(configSchema),
      ...mockVitalsConfig,
      biometrics: { ...mockVitalsConfig.biometrics, bmiMinimumAge: 18 },
    } as ConfigObject);

    mockUseVitalsAndBiometrics.mockReturnValue({
      data: formattedVitals,
    } as ReturnType<typeof useVitalsAndBiometrics>);

    const minorPatient = {
      ...mockFhirPatient,
      birthDate: '2020-01-01',
    } as fhir.Patient;
    renderWithSwr(<VitalsHeader {...testProps} patient={minorPatient} />);
    await waitForLoadingToFinish();

    expect(screen.queryByText(/BMI/i)).not.toBeInTheDocument();
  });

  it('shows BMI by default (bmiMinimumAge = 0)', async () => {
    mockUseConfig.mockReturnValue({
      ...getDefaultsFromConfigSchema(configSchema),
      ...mockVitalsConfig,
    } as ConfigObject);

    mockUseVitalsAndBiometrics.mockReturnValue({
      data: formattedVitals,
    } as ReturnType<typeof useVitalsAndBiometrics>);
    renderWithSwr(<VitalsHeader {...testProps} />);
    await waitForLoadingToFinish();

    expect(getByTextWithMarkup(/BMI\s*/i)).toBeInTheDocument();
  });
});
