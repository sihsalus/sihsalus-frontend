import { getDefaultsFromConfigSchema, useConfig } from '@openmrs/esm-framework';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  formattedBiometrics,
  mockBiometricsConfig,
  mockConceptMetadata,
  mockConceptUnits,
  mockFhirPatient,
  mockPatient,
  patientChartBasePath,
  renderWithSwr,
  waitForLoadingToFinish,
} from 'test-utils';

import { useVitalsAndBiometrics } from '../common';
import { type ConfigObject, configSchema } from '../config-schema';

import BiometricsOverview from './biometrics-overview.component';

const testProps = {
  basePath: patientChartBasePath,
  patientUuid: mockPatient.id,
  patient: mockFhirPatient as fhir.Patient,
};

const mockUseConfig = vi.mocked(useConfig<ConfigObject>);
const mockUseVitalsAndBiometrics = vi.mocked(useVitalsAndBiometrics);

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
  ...(getDefaultsFromConfigSchema(configSchema) as Record<string, unknown>),
  ...mockBiometricsConfig,
} as unknown as ConfigObject);

describe('BiometricsOverview', () => {
  it('renders an empty state view if biometrics data is unavailable', async () => {
    mockUseVitalsAndBiometrics.mockReturnValue({
      data: [],
    } as ReturnType<typeof useVitalsAndBiometrics>);

    renderWithSwr(<BiometricsOverview {...testProps} />);

    await waitForLoadingToFinish();

    await screen.findByRole('heading', { name: /biometrics/i });
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByText(/There are no biometrics to display for this patient/i)).toBeInTheDocument();
    expect(screen.getByText(/Record biometrics/i)).toBeInTheDocument();
  });

  it('renders an error state view if there is a problem fetching biometrics data', async () => {
    const mockError = {
      message: '401 Unauthorized',
      response: {
        status: 401,
        statusText: 'Unauthorized',
      },
    } as unknown as Error;

    mockUseVitalsAndBiometrics.mockReturnValue({
      error: mockError,
    } as ReturnType<typeof useVitalsAndBiometrics>);

    renderWithSwr(<BiometricsOverview {...testProps} />);

    await waitForLoadingToFinish();

    await screen.findByRole('heading', { name: /biometrics/i });
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByText(/Error 401: Unauthorized/i)).toBeInTheDocument();
    expect(
      screen.getByText(
        /Sorry, there was a problem displaying this information. You can try to reload this page, or contact the site administrator and quote the error code above/i,
      ),
    ).toBeInTheDocument();
  });

  it("renders a tabular overview of the patient's biometrics data when available", async () => {
    const user = userEvent.setup();

    mockUseVitalsAndBiometrics.mockReturnValue({
      data: formattedBiometrics,
    } as ReturnType<typeof useVitalsAndBiometrics>);

    renderWithSwr(<BiometricsOverview {...testProps} />);

    await waitForLoadingToFinish();

    await screen.findByRole('heading', { name: /biometrics/i });
    screen.getByRole('table', { name: /biometrics/i });
    expect(screen.getByRole('tab', { name: /table view/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /chart view/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /see all/i })).toBeInTheDocument();

    const getDataRowText = () =>
      screen
        .getAllByRole('row')
        .slice(1)
        .map((row) => row.textContent);

    const initialRowElements = getDataRowText();

    const expectedColumnHeaders = [/date/, /weight/, /height/, /bmi/, /muac/];
    expectedColumnHeaders.map((header) =>
      expect(screen.getByRole('columnheader', { name: new RegExp(header, 'i') })).toBeInTheDocument(),
    );

    const tableRows = getDataRowText().map((row) => row ?? '');
    expect(
      tableRows.some((row) => row.includes('90') && row.includes('186') && row.includes('26.0') && row.includes('17')),
    ).toBe(true);

    const sortRowsButton = screen.getByRole('button', { name: /date and time/i });

    // Sorting in descending order
    // Since the date order is already in descending order, the rows should be the same
    await user.click(sortRowsButton);
    // Sorting in ascending order
    await user.click(sortRowsButton);

    expect(getDataRowText()).toHaveLength(initialRowElements.length);

    // Sorting order = NONE, hence it is still in the ascending order
    await user.click(sortRowsButton);
    // Sorting in descending order
    await user.click(sortRowsButton);

    expect(getDataRowText()).toHaveLength(initialRowElements.length);
  });

  it('toggles between rendering either a tabular view or a chart view', async () => {
    const user = userEvent.setup();

    mockUseVitalsAndBiometrics.mockReturnValue({
      data: formattedBiometrics.slice(0, 2),
    } as ReturnType<typeof useVitalsAndBiometrics>);

    renderWithSwr(<BiometricsOverview {...testProps} />);

    await waitForLoadingToFinish();
    await screen.findByRole('table', { name: /biometrics/i });

    const chartViewButton = screen.getByRole('tab', {
      name: /chart view/i,
    });

    await user.click(chartViewButton);

    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByText(/biometric displayed/i)).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /weight/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /height/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /bmi/i })).toBeInTheDocument();
  });

  it('hides BMI column when bmiMinimumAge is set and patient is under the minimum age', async () => {
    const minorPatient = { ...mockFhirPatient, birthDate: '2020-01-01' } as fhir.Patient;

    mockUseConfig.mockReturnValue({
      ...(getDefaultsFromConfigSchema(configSchema) as Record<string, unknown>),
      ...mockBiometricsConfig,
      biometrics: { ...mockBiometricsConfig.biometrics, bmiMinimumAge: 18 },
    } as unknown as ConfigObject);

    mockUseVitalsAndBiometrics.mockReturnValue({ data: formattedBiometrics } as ReturnType<
      typeof useVitalsAndBiometrics
    >);

    renderWithSwr(<BiometricsOverview {...{ ...testProps, patient: minorPatient }} />);
    await waitForLoadingToFinish();
    await screen.findByRole('heading', { name: /biometrics/i });

    expect(screen.queryByRole('columnheader', { name: /bmi/i })).not.toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /weight/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /height/i })).toBeInTheDocument();
  });
});
