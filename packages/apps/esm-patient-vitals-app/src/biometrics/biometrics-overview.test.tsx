import { LineChart } from '@carbon/charts-react';
import { getDefaultsFromConfigSchema, useConfig, userHasAccess } from '@openmrs/esm-framework';
import { screen, within } from '@testing-library/react';
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
const mockUserHasAccess = vi.mocked(userHasAccess);
mockUserHasAccess.mockReturnValue(true);

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
    expect(screen.queryByText(/Error 401: Unauthorized/i)).not.toBeInTheDocument();
    expect(screen.getByText(/there was a problem displaying this information/i)).toBeInTheDocument();
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

    const expectedColumnHeaders = [/date/, /weight/, /height/, /bmi/, /muac/, /abdominal circumference/];
    expectedColumnHeaders.map((header) =>
      expect(screen.getByRole('columnheader', { name: new RegExp(header, 'i') })).toBeInTheDocument(),
    );

    const tableRows = getDataRowText().map((row) => row ?? '');
    expect(
      tableRows.some(
        (row) =>
          row.includes('90') && row.includes('186') && row.includes('26.0') && row.includes('17') && row.includes('95'),
      ),
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
    expect(screen.getByRole('tab', { name: /muac/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /abdominal circumference/i })).toBeInTheDocument();

    const biometricSelector = screen.getByRole('tablist', { name: /biometric displayed/i });
    const biometricTabs = within(biometricSelector).getAllByRole('tab');
    expect(biometricTabs).toHaveLength(5);
    expect(biometricSelector).toHaveAttribute('aria-orientation', 'vertical');
    expect(biometricSelector.closest('.cds--tabs--vertical')).not.toBeNull();
    biometricTabs.forEach((tab) => {
      expect(document.getElementById(tab.getAttribute('aria-controls') ?? '')).toHaveAttribute('role', 'tabpanel');
    });

    const weightTab = within(biometricSelector).getByRole('tab', { name: /weight/i });
    const heightTab = within(biometricSelector).getByRole('tab', { name: /height/i });
    weightTab.focus();
    await user.keyboard('{ArrowDown}');
    expect(heightTab).toHaveAttribute('aria-selected', 'true');
    expect(document.getElementById(heightTab.getAttribute('aria-controls') ?? '')).not.toHaveAttribute('hidden');

    const chartOptions = vi.mocked(LineChart).mock.calls.at(-1)?.[0].options;

    expect(chartOptions).toMatchObject({
      title: expect.stringMatching(/height/i),
      locale: {
        translations: {
          toolbar: {
            exitFullScreen: 'Exit fullscreen',
            exportAsCSV: 'Export to CSV',
            exportAsPNG: 'Export to PNG',
            makeFullScreen: 'Make fullscreen',
          },
        },
      },
      fileDownload: {
        fileName: 'biometrics-chart',
      },
      toolbar: {
        controls: expect.arrayContaining([
          { type: 'Export as CSV' },
          { type: 'Export as PNG' },
          { type: 'Make fullscreen' },
        ]),
      },
    });
  });

  it('shows every biometric selector without horizontal scrolling on small screens', async () => {
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query === '(max-width: 42rem)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    try {
      const user = userEvent.setup();
      mockUseVitalsAndBiometrics.mockReturnValue({
        data: formattedBiometrics.slice(0, 2),
      } as ReturnType<typeof useVitalsAndBiometrics>);

      renderWithSwr(<BiometricsOverview {...testProps} />);
      await waitForLoadingToFinish();
      await user.click(screen.getByRole('tab', { name: /chart view/i }));

      const biometricSelector = screen.getByRole('tablist', { name: /biometric displayed/i });
      expect(within(biometricSelector).getAllByRole('tab')).toHaveLength(5);
      expect(biometricSelector).toHaveAttribute('aria-orientation', 'horizontal');
      expect(biometricSelector.closest('.cds--tabs--vertical')).toBeNull();
      expect(biometricSelector.closest('[data-chart-tablist-wrapper]')).not.toBeNull();

      const [weightTab, heightTab] = within(biometricSelector).getAllByRole('tab');
      weightTab.focus();
      await user.keyboard('{ArrowRight}');
      expect(heightTab).toHaveAttribute('aria-selected', 'true');
    } finally {
      window.matchMedia = originalMatchMedia;
    }
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
