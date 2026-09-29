// Adapted from OpenMRS patient-management df9d1478f6786ca65541f1a6b6ffdb91f8223fb2 (MPL-2.0).

import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithSwr } from 'test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useBedsGroupedByLocation } from '../summary/summary.resource';
import type { BedWithLocation } from '../types';
import BedAdministrationTable from './bed-administration-table.component';
import EditBedForm from './edit-bed-form.component';
import NewBedForm from './new-bed-form.component';

vi.mock('../summary/summary.resource', () => ({
  useBedsGroupedByLocation: vi.fn(),
}));

const mockUseBedsGroupedByLocation = vi.mocked(useBedsGroupedByLocation);
// The local app opens modals, while upstream opens Workspace v2. Keep the
// real table and Carbon controls; isolate only the form/persistence boundary.
vi.mock('./new-bed-form.component', () => ({
  default: vi.fn(() => <div role="dialog" aria-label="New bed" />),
}));
vi.mock('./edit-bed-form.component', () => ({
  default: vi.fn(() => <div role="dialog" aria-label="Edit bed" />),
}));
const mockNewBedForm = vi.mocked(NewBedForm);
const mockEditBedForm = vi.mocked(EditBedForm);

const mockMutateBeds = vi.fn();

const mockBeds: BedWithLocation[][] = [
  [
    {
      id: 1,
      uuid: 'bed-uuid-1',
      bedNumber: 'BED-001',
      status: 'AVAILABLE' as const,
      row: 1,
      column: 1,
      location: { uuid: 'location-uuid-1', display: 'Ward A' },
    },
    {
      id: 2,
      uuid: 'bed-uuid-2',
      bedNumber: 'BED-002',
      status: 'OCCUPIED' as const,
      row: 1,
      column: 2,
      location: { uuid: 'location-uuid-1', display: 'Ward A' },
    },
  ],
  [
    {
      id: 3,
      uuid: 'bed-uuid-3',
      bedNumber: 'BED-003',
      status: 'AVAILABLE' as const,
      row: 2,
      column: 1,
      location: { uuid: 'location-uuid-2', display: 'Ward B' },
    },
  ],
];

const defaultHookReturn = {
  bedsGroupedByLocation: mockBeds,
  isLoadingBedsGroupedByLocation: false,
  isValidatingBedsGroupedByLocation: false,
  mutateBedsGroupedByLocation: mockMutateBeds,
  errorFetchingBedsGroupedByLocation: null,
};

describe('BedAdministrationTable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseBedsGroupedByLocation.mockReturnValue(defaultHookReturn);
  });

  it('renders table headers correctly', () => {
    renderWithSwr(<BedAdministrationTable />);

    expect(screen.getByRole('columnheader', { name: /bed id/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /location/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /occupancy status/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /allocated/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /actions/i })).toBeInTheDocument();
  });

  it('renders bed data in table rows', () => {
    renderWithSwr(<BedAdministrationTable />);

    expect(screen.getByRole('cell', { name: 'BED-001' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'BED-002' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'BED-003' })).toBeInTheDocument();
    expect(screen.getAllByRole('cell', { name: /ward a/i }).length).toBeGreaterThan(0);
    expect(screen.getByRole('cell', { name: /ward b/i })).toBeInTheDocument();
  });

  it('renders loading skeleton when data is loading', () => {
    mockUseBedsGroupedByLocation.mockReturnValue({
      ...defaultHookReturn,
      bedsGroupedByLocation: [],
      isLoadingBedsGroupedByLocation: true,
    });

    renderWithSwr(<BedAdministrationTable />);

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('renders error state when fetching beds fails', () => {
    mockUseBedsGroupedByLocation.mockReturnValue({
      ...defaultHookReturn,
      bedsGroupedByLocation: [],
      errorFetchingBedsGroupedByLocation: new Error('Failed to fetch beds'),
    });

    renderWithSwr(<BedAdministrationTable />);

    expect(screen.getByText(/error state/i)).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('renders empty state when no beds match the filter', async () => {
    const user = userEvent.setup();

    mockUseBedsGroupedByLocation.mockReturnValue({
      ...defaultHookReturn,
      bedsGroupedByLocation: [
        [
          {
            id: 1,
            uuid: 'bed-uuid-1',
            bedNumber: 'BED-001',
            status: 'AVAILABLE' as const,
            row: 1,
            column: 1,
            location: { uuid: 'location-uuid-1', display: 'Ward A' },
          },
        ],
      ],
    });

    renderWithSwr(<BedAdministrationTable />);

    const dropdown = screen.getByRole('combobox', { name: /filter by occupancy status/i });
    await user.click(dropdown);
    await user.click(screen.getByRole('option', { name: /occupied/i }));

    expect(screen.getByText(/no data to display/i)).toBeInTheDocument();
  });

  it('filters beds by occupancy status', async () => {
    const user = userEvent.setup();

    renderWithSwr(<BedAdministrationTable />);

    const dropdown = screen.getByRole('combobox', { name: /filter by occupancy status/i });
    await user.click(dropdown);
    await user.click(screen.getByRole('option', { name: /occupied/i }));

    expect(screen.queryByRole('cell', { name: 'BED-001' })).not.toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'BED-002' })).toBeInTheDocument();
    expect(screen.queryByRole('cell', { name: 'BED-003' })).not.toBeInTheDocument();
  });

  it('opens the local add bed modal when "Add bed" button is clicked', async () => {
    const user = userEvent.setup();

    renderWithSwr(<BedAdministrationTable />);

    const addBedButton = screen.getAllByRole('button', { name: /add bed/i })[0];
    await user.click(addBedButton);

    expect(screen.getByRole('dialog', { name: 'New bed' })).toBeInTheDocument();
    expect(mockNewBedForm.mock.calls.at(-1)?.[0]).toMatchObject({
      mutate: mockMutateBeds,
      showModal: true,
    });
  });

  it('opens the local edit modal with the selected bed', async () => {
    const user = userEvent.setup();

    renderWithSwr(<BedAdministrationTable />);

    const editButtons = screen.getAllByRole('button', { name: /edit bed/i });
    await user.click(editButtons[0]);

    expect(screen.getByRole('dialog', { name: 'Edit bed' })).toBeInTheDocument();
    expect(mockEditBedForm.mock.calls.at(-1)?.[0]).toMatchObject({
      editData: mockBeds[0][0],
      mutate: mockMutateBeds,
      showModal: true,
    });
  });

  it('shows inline loading indicator while revalidating', () => {
    mockUseBedsGroupedByLocation.mockReturnValue({
      ...defaultHookReturn,
      isValidatingBedsGroupedByLocation: true,
    });

    renderWithSwr(<BedAdministrationTable />);

    expect(screen.getByTitle(/loading/i)).toBeInTheDocument();
  });

  it('renders the page header with correct title', () => {
    renderWithSwr(<BedAdministrationTable />);

    expect(screen.getByRole('heading', { name: /ward allocation/i })).toBeInTheDocument();
  });

  it('paginates real bed rows and returns to the first page', async () => {
    const user = userEvent.setup();
    mockUseBedsGroupedByLocation.mockReturnValue({
      ...defaultHookReturn,
      bedsGroupedByLocation: [
        Array.from({ length: 11 }, (_, index) => ({
          ...mockBeds[0][0],
          id: index + 1,
          uuid: `synthetic-bed-${index}`,
          bedNumber: `SYNTHETIC-${index + 1}`,
        })),
      ],
    });
    renderWithSwr(<BedAdministrationTable />);
    expect(screen.getByRole('cell', { name: 'SYNTHETIC-1' })).toBeInTheDocument();
    expect(screen.queryByRole('cell', { name: 'SYNTHETIC-11' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /next page/i }));
    expect(screen.getByRole('cell', { name: 'SYNTHETIC-11' })).toBeInTheDocument();
    expect(screen.queryByRole('cell', { name: 'SYNTHETIC-1' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /previous page/i }));
    expect(screen.getByRole('cell', { name: 'SYNTHETIC-1' })).toBeInTheDocument();
  });
});
