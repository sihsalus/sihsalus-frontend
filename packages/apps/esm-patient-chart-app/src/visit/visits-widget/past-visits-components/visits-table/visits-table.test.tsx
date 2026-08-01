import {
  formatDatetime,
  getConfig,
  parseDate,
  showModal,
  userHasAccessToRequiredPrivilege,
  useSession,
} from '@openmrs/esm-framework';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mockEncounters, mockPatient, renderWithSwr } from 'test-utils';

import { clinicalChartPrivilege, clinicalFormsEditPrivilege } from '../../../../constants';
import VisitsTable from './visits-table.component';

const defaultProps = {
  patientUuid: mockPatient.id,
  showAllEncounters: true,
  visits: mockEncounters,
};

const mockShowModal = vi.mocked(showModal);
const mockGetConfig = getConfig as vi.Mock;
const mockUseSession = vi.mocked(useSession);
const mockUserHasRequiredPrivilege = vi.mocked(userHasAccessToRequiredPrivilege);
const getProviderName = (provider: unknown) =>
  typeof provider === 'string'
    ? provider
    : provider && typeof provider === 'object' && 'name' in provider
      ? String(provider.name ?? '--')
      : '--';

beforeEach(() => {
  mockUseSession.mockReturnValue({
    authenticated: true,
    user: { uuid: 'user-uuid', privileges: [], roles: [] },
  } as ReturnType<typeof useSession>);
});

describe('EncounterList', () => {
  beforeEach(() => {
    mockUserHasRequiredPrivilege.mockImplementation((requiredPrivilege) =>
      ['edit', 'view', clinicalChartPrivilege].includes(String(requiredPrivilege)),
    );
  });

  it('renders an empty state when no encounters are available', async () => {
    mockGetConfig.mockResolvedValue({ htmlFormEntryForms: [] });

    renderVisitsTable({ visits: [] });

    await screen.findByTitle(/empty data illustration/i);
    expect(screen.getByText(/there are no encounters to display for this patient/i)).toBeInTheDocument();
  });

  it('does not render clinical history while the authenticated user is unavailable', async () => {
    mockUseSession.mockReturnValue({ authenticated: true } as ReturnType<typeof useSession>);

    renderVisitsTable({ visits: mockEncounters });

    await screen.findByTitle(/empty data illustration/i);
    expect(screen.queryByText('POC Consent Form')).not.toBeInTheDocument();
  });

  it("renders a tabular overview of the patient's clinical encounters", async () => {
    const user = userEvent.setup();

    renderVisitsTable({ visits: mockEncounters });

    await screen.findByRole('table');

    const filterDropdown = screen.getByRole('combobox', { name: /filter by encounter type/i });
    const searchbox = screen.getByRole('searchbox', { name: /filter table/i });
    const expectedColumnHeaders = [/date & time/, /visit type/, /Form name/, /encounter type/, /provider/];
    const expectedTableRows = mockEncounters.map(
      ({ datetime, encounterType, form, provider, visitType }) =>
        `${formatDatetime(parseDate(datetime))} ${visitType} ${encounterType} ${form?.display ?? '--'} ${getProviderName(
          provider,
        )} Options`,
    );

    expectedColumnHeaders.forEach((header) => {
      expect(screen.getByRole('columnheader', { name: new RegExp(header, 'i') })).toBeInTheDocument();
    });
    expectedTableRows.forEach((row) => {
      expect(screen.getByRole('row', { name: new RegExp(row, 'i') })).toBeInTheDocument();
    });

    // filter table to show only `Admission` encounters
    await user.click(filterDropdown);
    await user.click(screen.getByRole('option', { name: /Admission/i }));

    // screen.logTestingPlaygroundURL();
    expect(screen.queryByRole('cell', { name: /visit note/i })).not.toBeInTheDocument();
    expect(screen.getByRole('cell', { name: /admission/i })).toBeInTheDocument();

    // show all encounter types
    await user.click(filterDropdown);
    await user.click(screen.getByRole('option', { name: /all/i }));

    // filter table by typing in the searchbox
    await user.type(searchbox, 'Visit Note');

    expect(screen.queryByText(/consultation/i)).not.toBeInTheDocument();
    expect(screen.getByText(/visit note/i)).toBeInTheDocument();

    await user.clear(searchbox);
    await user.type(searchbox, 'triage');

    expect(screen.getByText(/no encounters to display/i)).toBeInTheDocument();
    expect(screen.getByText(/check the filters above/i)).toBeInTheDocument();
  });

  it('does not disclose an encounter when its configured view privilege is missing', async () => {
    renderVisitsTable({
      visits: [
        { ...mockEncounters[0], id: 'restricted', viewPrivilege: 'View Restricted Encounter' },
        mockEncounters[1],
      ],
    });

    await screen.findByRole('table');

    expect(screen.queryByText('POC Consent Form')).not.toBeInTheDocument();
    expect(screen.getByText('Visit Note')).toBeInTheDocument();
  });

  it('displays an encounter when the configured view privilege is valid for the user', async () => {
    renderVisitsTable({ visits: [{ ...mockEncounters[0], viewPrivilege: 'view' }] });

    await screen.findByRole('table');

    expect(screen.getByText('POC Consent Form')).toBeInTheDocument();
  });
});

describe('Delete Encounter', () => {
  beforeEach(() => {
    mockUserHasRequiredPrivilege.mockImplementation((requiredPrivilege) =>
      ['edit', clinicalChartPrivilege].includes(String(requiredPrivilege)),
    );
  });

  it('does not offer edit or delete actions when edit privilege metadata is absent', async () => {
    const user = userEvent.setup();

    renderVisitsTable({ visits: [{ ...mockEncounters[0], editPrivilege: undefined }] });

    const row = await screen.findByRole('row', { name: /POC Consent Form/i });
    await user.click(within(row).getByRole('button', { name: /expand current row/i }));

    expect(screen.queryByRole('button', { name: /edit this encounter/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /delete this encounter/i })).not.toBeInTheDocument();
  });

  it('uses the explicit generic edit capability for legacy encounter types without metadata', async () => {
    const user = userEvent.setup();
    mockUserHasRequiredPrivilege.mockImplementation((requiredPrivilege) =>
      [clinicalChartPrivilege, clinicalFormsEditPrivilege].includes(String(requiredPrivilege)),
    );

    renderVisitsTable({ visits: [{ ...mockEncounters[0], editPrivilege: undefined }] });

    const row = await screen.findByRole('row', { name: /POC Consent Form/i });
    await user.click(within(row).getByRole('button', { name: /expand current row/i }));

    expect(screen.getByRole('button', { name: /edit this encounter/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /delete this encounter/i })).toBeInTheDocument();
  });

  it('Clicking the `Delete` button deletes an encounter', async () => {
    const user = userEvent.setup();

    renderVisitsTable({ visits: mockEncounters });

    await screen.findByRole('table');
    expect(screen.getByRole('table')).toBeInTheDocument();

    const firstEncounter = mockEncounters[2];
    const row = screen.getByRole('row', {
      name: new RegExp(
        `${formatDatetime(parseDate(firstEncounter.datetime))} ${firstEncounter.visitType} ${
          firstEncounter.encounterType
        } ${firstEncounter.form?.display ?? '--'} ${getProviderName(firstEncounter.provider)} Options`,
        'i',
      ),
    });

    await user.click(within(row).getByRole('button', { name: /expand current row/i }));
    await user.click(screen.getByRole('button', { name: /danger Delete this encounter/i }));

    expect(mockShowModal).toHaveBeenCalledTimes(1);
    expect(mockShowModal).toHaveBeenCalledWith(
      'delete-encounter-modal',
      expect.objectContaining({
        encounterTypeName: 'Covid 19',
      }),
    );
  });
});

function renderVisitsTable(props = {}) {
  renderWithSwr(<VisitsTable {...defaultProps} {...props} />);
}
