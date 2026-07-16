import { getDefaultsFromConfigSchema, useConfig, userHasAccess } from '@openmrs/esm-framework';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import {
  formattedVitals,
  mockConceptMetadata,
  mockConceptUnits,
  mockFhirPatient,
  mockPatient,
  mockVitalsConfig,
  renderWithSwr,
  waitForLoadingToFinish,
} from 'test-utils';

import { useVitalsAndBiometrics } from '../common';
import { type ConfigObject, configSchema } from '../config-schema';

import VitalsOverview from './vitals-overview.component';

dayjs.extend(utc);

const testProps = {
  patientUuid: mockPatient.id,
  pageSize: 5,
  pageUrl: '',
  urlLabel: '',
  patient: mockFhirPatient as fhir.Patient,
};

const mockUseConfig = vi.mocked(useConfig<ConfigObject>);
const mockUseVitalsAndBiometrics = vi.mocked(useVitalsAndBiometrics);
const mockUserHasAccess = vi.mocked(userHasAccess);
mockUserHasAccess.mockReturnValue(true);

global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

vi.mock('@openmrs/esm-patient-common-lib', async () => {
  const originalModule = await vi.importActual('@openmrs/esm-patient-common-lib');

  return {
    ...originalModule,
    launchPatientWorkspace: vi.fn(),
  };
});

vi.mock('../common', async () => {
  const originalModule = await vi.importActual('../common');

  return {
    ...originalModule,
    launchPatientWorkspace: vi.fn(),
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

describe('VitalsOverview', () => {
  it('renders an empty state view if vitals data is unavailable', async () => {
    mockUseVitalsAndBiometrics.mockReturnValue({
      data: [],
    } as ReturnType<typeof useVitalsAndBiometrics>);

    renderWithSwr(<VitalsOverview {...testProps} />);

    await waitForLoadingToFinish();
    await screen.findByRole('heading', { name: /vitals/i });
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByText(/There are no vital signs to display for this patient/i)).toBeInTheDocument();
    expect(screen.getByText(/record vital signs/i)).toBeInTheDocument();
  });

  it('renders an error state view if there is a problem fetching allergies data', async () => {
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

    renderWithSwr(<VitalsOverview {...testProps} />);

    await waitForLoadingToFinish();

    await screen.findByRole('heading', { name: /vitals/i });
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByText(/Error 401: Unauthorized/i)).not.toBeInTheDocument();
    expect(screen.getByText(/there was a problem displaying this information/i)).toBeInTheDocument();
  });

  it("renders a tabular overview of the patient's vital signs", async () => {
    const user = userEvent.setup();

    mockUseVitalsAndBiometrics.mockReturnValue({
      data: formattedVitals,
    } as ReturnType<typeof useVitalsAndBiometrics>);

    renderWithSwr(<VitalsOverview {...testProps} />);

    await waitForLoadingToFinish();
    expect(screen.getByRole('table', { name: /vitals/i })).toBeInTheDocument();

    const getDataRowText = () =>
      screen
        .getAllByRole('row')
        .slice(1)
        .map((row) => row.textContent);

    const initialRowElements = getDataRowText();

    const expectedColumnHeaders = [/date and time/, /bp/, /r. rate/, /pulse/, /spO2/, /temp/];

    expectedColumnHeaders.forEach((header) => {
      expect(screen.getByRole('columnheader', { name: new RegExp(header, 'i') })).toBeInTheDocument();
    });

    const expectedTableRows = [
      ...formattedVitals
        .slice(0, 4)
        .map((vital) => new RegExp(dayjs.utc(vital.date).local().format('DD .* MMM .* YYYY'), 'i')),
      /121 \/ 89/,
      /120 \/ 90/,
      /120 \/ 80/,
      /36\.5/,
    ];
    expectedTableRows.forEach((row) => {
      expect(screen.getByText(row)).toBeInTheDocument();
    });

    const sortRowsButton = screen.getByRole('button', {
      name: /date and time/i,
    });

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
      data: formattedVitals,
    } as ReturnType<typeof useVitalsAndBiometrics>);

    renderWithSwr(<VitalsOverview {...testProps} />);

    await waitForLoadingToFinish();

    expect(screen.getByRole('table', { name: /vitals/i })).toBeInTheDocument();

    const chartViewButton = screen.getByRole('tab', {
      name: /chart view/i,
    });

    await user.click(chartViewButton);
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByText(/vital sign displayed/i)).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /bp/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /pulse/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /spo2/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /temp/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /r\. rate/i })).toBeInTheDocument();
  });

  it('expands a vitals row to show an associated note', async () => {
    const user = userEvent.setup();
    const vitalsWithNote = formattedVitals.map((v, i) =>
      i === 0 ? { ...v, note: 'Pt reports severe L chest pain' } : v,
    );

    mockUseVitalsAndBiometrics.mockReturnValue({
      data: vitalsWithNote,
    } as ReturnType<typeof useVitalsAndBiometrics>);

    renderWithSwr(<VitalsOverview {...testProps} />);
    await waitForLoadingToFinish();

    const expandButtons = screen.queryAllByRole('button', {
      name: /expand current row/i,
    });
    expect(expandButtons.length).toBeGreaterThan(0);
    await user.click(expandButtons[0]);
    expect(screen.getByText(/Pt reports severe L chest pain/i)).toBeInTheDocument();
  });
});
