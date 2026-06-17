import {
  type FetchResponse,
  getDefaultsFromConfigSchema,
  launchWorkspace2,
  openmrsFetch,
  useConfig,
  userHasAccess,
} from '@openmrs/esm-framework';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mockPatient, mockProceduresResponse, renderWithSwr, waitForLoadingToFinish } from 'test-utils';
import { describe, expect, it, vi } from 'vitest';
import { type ConfigObject, configSchema } from '../../config-schema';
import ProceduresDetailedSummary from './procedures-detailed-summary.component';

vi.mock('../action-menu/procedures-action-menu.component', () => ({
  ProceduresActionMenu: vi.fn().mockReturnValue(null),
}));

const mockUseConfig = vi.mocked(useConfig<ConfigObject>);
const mockOpenmrsFetch = vi.mocked(openmrsFetch);
const mockLaunchWorkspace2 = vi.mocked(launchWorkspace2);
const mockFhirPatient = mockPatient as unknown as fhir.Patient;

mockUseConfig.mockReturnValue({
  ...getDefaultsFromConfigSchema(configSchema),
  detailedViewPageSize: 20,
});

// The "Add" action is gated behind the procedures edit privilege; grant it so the button renders.
vi.mocked(userHasAccess).mockReturnValue(true);

describe('ProceduresDetailedSummary', () => {
  it('renders an empty state view if procedures data is unavailable', async () => {
    mockOpenmrsFetch.mockResolvedValueOnce({ data: { results: [] } } as FetchResponse);

    renderWithSwr(<ProceduresDetailedSummary patient={mockFhirPatient} />);

    await waitForLoadingToFinish();

    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /procedures/i })).toBeInTheDocument();
    expect(screen.getByTestId('empty-card-illustration')).toBeInTheDocument();
    expect(screen.getByText(/There are no procedures to display/i)).toBeInTheDocument();
  });

  it('renders an error state view if there is a problem fetching procedures', async () => {
    const error = {
      message: 'You are not logged in',
      response: {
        status: 401,
        statusText: 'Unauthorized',
      },
    };

    mockOpenmrsFetch.mockRejectedValueOnce(error);

    renderWithSwr(<ProceduresDetailedSummary patient={mockFhirPatient} />);

    await waitForLoadingToFinish();

    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByText('Error State')).toBeInTheDocument();
  });

  it("renders a detailed summary of all the patient's procedures without pagination", async () => {
    mockOpenmrsFetch.mockResolvedValueOnce({ data: mockProceduresResponse } as FetchResponse);

    renderWithSwr(<ProceduresDetailedSummary patient={mockFhirPatient} />);

    await waitForLoadingToFinish();

    expect(screen.getByRole('heading', { name: /procedures/i })).toBeInTheDocument();

    const expectedColumnHeaders = ['Procedure', 'Procedure type', 'Body site', 'Start date', 'End date', 'Status'];
    expectedColumnHeaders.forEach((header) => {
      expect(screen.getByRole('button', { name: header })).toBeInTheDocument();
    });

    // All 6 procedures should be displayed
    const expectedTableRows = [/appendectomy/i, /colonoscopy/i, /blood draw/i, /chest x-ray/i, /ecg/i, /mri brain/i];
    expectedTableRows.forEach((row) => {
      expect(screen.getByRole('row', { name: row })).toBeInTheDocument();
    });

    // Header row + 6 data rows + 6 collapsed expanded rows (CSS not loaded in Jest) = 13
    expect(screen.getAllByRole('row').length).toEqual(13);
    expect(screen.getByRole('button', { name: /next page/i })).toBeDisabled();
  });

  it('renders duration and notes in the expanded row', async () => {
    const user = userEvent.setup();

    mockOpenmrsFetch.mockResolvedValueOnce({ data: mockProceduresResponse } as FetchResponse);

    renderWithSwr(<ProceduresDetailedSummary patient={mockFhirPatient} />);

    await waitForLoadingToFinish();

    const expandButtons = screen.getAllByRole('button', { name: /expand current row/i });
    await user.click(expandButtons[0]);

    expect(screen.getByText(/45 Minutes/i)).toBeInTheDocument();
    expect(screen.getByText(/Procedure went well/i)).toBeInTheDocument();
  });

  it('renders incomplete procedure records without crashing', async () => {
    mockOpenmrsFetch.mockResolvedValueOnce({
      data: {
        results: [
          {
            uuid: 'proc-incomplete-1',
            procedureNonCoded: 'Custom procedure',
            voided: false,
          },
        ],
        links: [],
        totalCount: 1,
      },
    } as FetchResponse);

    renderWithSwr(<ProceduresDetailedSummary patient={mockFhirPatient} />);

    await waitForLoadingToFinish();

    const row = screen.getByRole('row', { name: /custom procedure/i });
    expect(row).toBeInTheDocument();
    expect(within(row).getAllByText('--').length).toBeGreaterThanOrEqual(4);
  });

  it('renders an "Add" button that launches the procedures form workspace', async () => {
    const user = userEvent.setup();

    mockOpenmrsFetch.mockResolvedValueOnce({ data: mockProceduresResponse } as FetchResponse);

    renderWithSwr(<ProceduresDetailedSummary patient={mockFhirPatient} />);

    await waitForLoadingToFinish();

    const addButton = screen.getByRole('button', { name: /add/i });
    expect(addButton).toBeInTheDocument();

    await user.click(addButton);
    expect(mockLaunchWorkspace2).toHaveBeenCalledWith('procedures-form-workspace', { formContext: 'creating' });
  });
});
