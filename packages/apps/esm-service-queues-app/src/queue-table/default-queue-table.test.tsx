import { getDefaultsFromConfigSchema, useConfig, useSession } from '@openmrs/esm-framework';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  mockLocationSurgery,
  mockLocationTriage,
  mockQueueEntries,
  mockQueueRooms,
  mockSession,
  mockStatusInService,
  mockStatusWaiting,
  mockStatusWaitingForTransfer,
  renderWithSwr,
} from 'test-utils';

import { useQueueRooms } from '../add-provider-queue-room-modal/add-provider-queue-room.resource';
import { type ConfigObject, configSchema } from '../config-schema';
import { useQueueLocations } from '../create-queue-entry/hooks/useQueueLocations';
import { useQueueEntries } from '../hooks/useQueueEntries';
import useQueueStatuses from '../hooks/useQueueStatuses';
import DefaultQueueTable from '../queue-table/default-queue-table.component';
import { updateSelectedQueueStatus, useServiceQueuesStore } from '../store/store';

const mockUseConfig = vi.mocked(useConfig<ConfigObject>);
const mockUseQueueEntries = vi.mocked(useQueueEntries);
const mockQueueLocations = vi.mocked(useQueueLocations);
const mockUseQueueRooms = vi.mocked(useQueueRooms);
const mockUseSession = vi.mocked(useSession);
const mockUseQueueStatuses = vi.mocked(useQueueStatuses);
const mockUpdateSelectedQueueStatus = vi.mocked(updateSelectedQueueStatus);
const mockUseServiceQueuesStore = vi.mocked(useServiceQueuesStore);

vi.mock('../create-queue-entry/hooks/useQueueLocations', async () => ({
  ...(await vi.importActual('../create-queue-entry/hooks/useQueueLocations')),
  useQueueLocations: vi.fn(),
}));

vi.mock('../add-provider-queue-room-modal/add-provider-queue-room.resource', async () => ({
  ...(await vi.importActual('../add-provider-queue-room-modal/add-provider-queue-room.resource')),
  useQueueRooms: vi.fn(),
}));

vi.mock('../hooks/useQueueEntries', async () => ({
  ...(await vi.importActual('../hooks/useQueueEntries')),
  useQueueEntries: vi.fn(),
}));

vi.mock('../hooks/useQueueStatuses', () => ({
  default: vi.fn(),
}));

vi.mock('../store/store', () => ({
  updateSelectedQueueStatus: vi.fn(),
  useServiceQueuesStore: vi.fn(),
}));

vi.mock('./queue-table.scss', () => ({
  default: new Proxy({}, { get: (_target, property) => String(property) }),
}));

describe('DefaultQueueTable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseConfig.mockReturnValue({
      ...getDefaultsFromConfigSchema(configSchema),
      customPatientChartUrl: 'someUrl',
      visitQueueNumberAttributeUuid: 'c61ce16f-272a-41e7-9924-4c555d0932c5',
    });
    mockUseSession.mockReturnValue(mockSession.data);
    mockUseQueueStatuses.mockReturnValue({
      statuses: [mockStatusInService, mockStatusWaiting, mockStatusWaitingForTransfer],
      isLoadingQueueStatuses: false,
      queueStatusesError: undefined,
    });
    mockUseServiceQueuesStore.mockReturnValue({
      selectedServiceUuid: null,
      selectedQueueLocationUuid: null,
      selectedQueueStatusUuid: null,
      selectedAppointmentStatus: '',
      selectedQueueRoomTimestamp: new Date(),
      isPermanentProviderQueueRoom: false,
    });
  });

  it('renders an empty state view if data is unavailable', async () => {
    mockQueueLocations.mockReturnValue({ queueLocations: [], isLoading: false, error: null });
    mockUseQueueRooms.mockReturnValue({ rooms: [], isLoading: false, error: undefined });
    mockUseQueueEntries.mockReturnValue({
      queueEntries: [],
      isLoading: false,
      error: undefined,
      totalCount: 0,
      isValidating: false,
      mutate: vi.fn(),
    });

    rendeDefaultQueueTable();

    await screen.findByRole('table');

    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(screen.getByText(/patients currently in queue/i)).toBeInTheDocument();
    expect(screen.getByText(/no patients to display/i)).toBeInTheDocument();

    const queueTableCard = screen.getByTestId('queue-table-card');
    expect(queueTableCard).toHaveClass('container');
    expect(within(queueTableCard).getByRole('table')).toBeInTheDocument();
    expect(within(queueTableCard).getByTestId('queue-empty-state')).toBeInTheDocument();
  });

  it('renders queue statuses above the card and updates the selected status', async () => {
    const user = userEvent.setup();
    mockQueueLocations.mockReturnValue({ queueLocations: [], isLoading: false, error: null });
    mockUseQueueRooms.mockReturnValue({ rooms: [], isLoading: false, error: undefined });
    mockUseQueueEntries.mockReturnValue({
      queueEntries: [],
      isLoading: false,
      error: undefined,
      totalCount: 0,
      isValidating: false,
      mutate: vi.fn(),
    });

    rendeDefaultQueueTable();

    const statusSwitcher = await screen.findByRole('tablist', { name: /queue status/i });
    const queueTableCard = screen.getByTestId('queue-table-card');
    expect(statusSwitcher.nextElementSibling).toBe(queueTableCard);
    expect(within(statusSwitcher).getByRole('tab', { name: /all/i })).toHaveAttribute('aria-selected', 'true');
    expect(within(statusSwitcher).getByRole('tab', { name: /in service/i })).toBeInTheDocument();
    expect(within(statusSwitcher).getByRole('tab', { name: /^waiting$/i })).toBeInTheDocument();
    expect(within(statusSwitcher).getByRole('tab', { name: /waiting for transfer/i })).toBeInTheDocument();
    expect(screen.queryByText(/show patients with status/i)).not.toBeInTheDocument();

    await user.click(within(statusSwitcher).getByRole('tab', { name: /^waiting$/i }));

    expect(mockUpdateSelectedQueueStatus).toHaveBeenCalledWith(mockStatusWaiting.uuid, mockStatusWaiting.display);

    await user.click(within(statusSwitcher).getByRole('tab', { name: /all/i }));

    expect(mockUpdateSelectedQueueStatus).toHaveBeenLastCalledWith(null, 'All');
  });

  it('restores a persisted status selection and applies it to the queue request', async () => {
    mockUseServiceQueuesStore.mockReturnValue({
      selectedServiceUuid: 'service-uuid',
      selectedQueueLocationUuid: 'location-uuid',
      selectedQueueStatusUuid: mockStatusWaiting.uuid,
      selectedAppointmentStatus: '',
      selectedQueueRoomTimestamp: new Date(),
      isPermanentProviderQueueRoom: false,
    });
    mockQueueLocations.mockReturnValue({ queueLocations: [], isLoading: false, error: null });
    mockUseQueueRooms.mockReturnValue({ rooms: [], isLoading: false, error: undefined });
    mockUseQueueEntries.mockReturnValue({
      queueEntries: [],
      isLoading: false,
      error: undefined,
      totalCount: 0,
      isValidating: false,
      mutate: vi.fn(),
    });

    rendeDefaultQueueTable();

    expect(await screen.findByRole('tab', { name: /^waiting$/i })).toHaveAttribute('aria-selected', 'true');
    expect(mockUseQueueEntries).toHaveBeenCalledWith({
      service: 'service-uuid',
      location: 'location-uuid',
      isEnded: false,
      status: mockStatusWaiting.uuid,
    });
  });

  it('clears a persisted status only after the available statuses finish loading', async () => {
    mockUseServiceQueuesStore.mockReturnValue({
      selectedServiceUuid: null,
      selectedQueueLocationUuid: null,
      selectedQueueStatusUuid: 'removed-status-uuid',
      selectedQueueStatusDisplay: 'Removed status',
      selectedAppointmentStatus: '',
      selectedQueueRoomTimestamp: new Date(),
      isPermanentProviderQueueRoom: false,
    });
    mockUseQueueStatuses.mockReturnValue({
      statuses: [],
      isLoadingQueueStatuses: true,
      queueStatusesError: undefined,
    });
    mockQueueLocations.mockReturnValue({ queueLocations: [], isLoading: false, error: null });
    mockUseQueueRooms.mockReturnValue({ rooms: [], isLoading: false, error: undefined });
    mockUseQueueEntries.mockReturnValue({
      queueEntries: [],
      isLoading: false,
      error: undefined,
      totalCount: 0,
      isValidating: false,
      mutate: vi.fn(),
    });

    const { rerender } = renderWithSwr(<DefaultQueueTable />);

    expect(mockUpdateSelectedQueueStatus).not.toHaveBeenCalled();
    expect(screen.getByRole('tab', { name: 'Removed status' })).toHaveAttribute('aria-selected', 'true');

    mockUseQueueStatuses.mockReturnValue({
      statuses: [],
      isLoadingQueueStatuses: false,
      queueStatusesError: new Error('Unable to load queues'),
    });
    rerender(<DefaultQueueTable />);

    expect(mockUpdateSelectedQueueStatus).not.toHaveBeenCalled();
    expect(screen.getByRole('tab', { name: 'Removed status' })).toHaveAttribute('aria-selected', 'true');

    mockUseQueueStatuses.mockReturnValue({
      statuses: [],
      isLoadingQueueStatuses: false,
      queueStatusesError: undefined,
    });
    rerender(<DefaultQueueTable />);

    await waitFor(() => expect(mockUpdateSelectedQueueStatus).toHaveBeenCalledWith(null, 'All'));
  });

  it('renders a tabular overview of visit queue entry data when available', async () => {
    mockQueueLocations.mockReturnValue({
      queueLocations: [mockLocationSurgery, mockLocationTriage],
      isLoading: false,
      error: null,
    });
    mockUseQueueRooms.mockReturnValue({ rooms: mockQueueRooms.data.results, isLoading: false, error: undefined });
    mockUseQueueEntries.mockReturnValue({
      queueEntries: mockQueueEntries,
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: vi.fn(),
      totalCount: 2,
    });

    rendeDefaultQueueTable();

    await screen.findByRole('table');

    expect(screen.getByText(/patients currently in queue/i)).toBeInTheDocument();
    expect(screen.queryByText(/no patients to display/i)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Brian Johnson/i })).toBeInTheDocument();
    const john = screen.getByRole('link', { name: /Alice Johnson/i });
    expect(john).toBeInTheDocument();
    expect(john).toHaveAttribute('href', 'someUrl');

    const expectedColumnHeaders = [
      /name/i,
      /priority/i,
      /coming from/i,
      /status/i,
      /^queue$/i,
      /wait time/i,
      /actions/i,
    ];
    expectedColumnHeaders.forEach((header) => {
      expect(
        screen.getByRole('columnheader', {
          name: header,
        }),
      ).toBeInTheDocument();
    });
  });
});

function rendeDefaultQueueTable() {
  renderWithSwr(<DefaultQueueTable />);
}
