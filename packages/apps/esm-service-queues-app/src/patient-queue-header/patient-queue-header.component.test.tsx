import { getDefaultsFromConfigSchema, useConfig } from '@openmrs/esm-framework';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mockQueueSurgery, mockQueueTriage, mockServiceTriage } from 'test-utils';

import { type ConfigObject, configSchema } from '../config-schema';
import { useQueueLocations } from '../create-queue-entry/hooks/useQueueLocations';
import { useQueues } from '../hooks/useQueues';
import { updateSelectedService, useServiceQueuesStore } from '../store/store';
import PatientQueueHeader from './patient-queue-header.component';

const mockUseConfig = vi.mocked(useConfig<ConfigObject>);
const mockUseQueueLocations = vi.mocked(useQueueLocations);
const mockUseQueues = vi.mocked(useQueues);
const mockUpdateSelectedService = vi.mocked(updateSelectedService);
const mockUseServiceQueuesStore = vi.mocked(useServiceQueuesStore);

vi.mock('../create-queue-entry/hooks/useQueueLocations', () => ({
  useQueueLocations: vi.fn(),
}));

vi.mock('../hooks/useQueues', () => ({
  useQueues: vi.fn(),
}));

vi.mock('../store/store', () => ({
  updateSelectedQueueLocationName: vi.fn(),
  updateSelectedQueueLocationUuid: vi.fn(),
  updateSelectedService: vi.fn(),
  useServiceQueuesStore: vi.fn(),
}));

vi.mock('./patient-queue-header.scss', () => ({
  default: new Proxy({}, { get: (_target, property) => String(property) }),
}));

const defaultStoreState = {
  selectedQueueLocationName: null,
  selectedQueueLocationUuid: null,
  selectedServiceDisplay: null,
  selectedServiceUuid: null,
  selectedQueueStatusDisplay: null,
  selectedQueueStatusUuid: null,
  selectedAppointmentStatus: '',
  selectedQueueRoomTimestamp: new Date('2026-07-16T00:00:00.000Z'),
  isPermanentProviderQueueRoom: false,
};

describe('PatientQueueHeader service filter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseConfig.mockReturnValue(getDefaultsFromConfigSchema(configSchema));
    mockUseQueueLocations.mockReturnValue({ queueLocations: [], isLoading: false, error: undefined });
    mockUseServiceQueuesStore.mockReturnValue(defaultStoreState);
    mockQueueResult([]);
  });

  it('keeps the service filter visible and selectable when only one queue is available', async () => {
    const user = userEvent.setup();
    mockQueueResult([mockQueueTriage]);

    const { rerender } = render(<PatientQueueHeader showFilters />);

    const serviceDropdown = screen.getByRole('combobox', { name: /select a service/i });
    expect(serviceDropdown).toBeEnabled();

    await user.click(serviceDropdown);
    expect(screen.getByRole('option', { name: 'All' })).toBeInTheDocument();
    await user.click(screen.getByRole('option', { name: mockServiceTriage.display }));
    expect(mockUpdateSelectedService).toHaveBeenCalledWith(mockServiceTriage.uuid, mockServiceTriage.display);

    mockUseServiceQueuesStore.mockReturnValue({
      ...defaultStoreState,
      selectedServiceUuid: mockServiceTriage.uuid,
      selectedServiceDisplay: mockServiceTriage.display,
    });
    rerender(<PatientQueueHeader showFilters />);
    await user.click(serviceDropdown);
    await user.click(screen.getByRole('option', { name: 'All' }));
    expect(mockUpdateSelectedService).toHaveBeenLastCalledWith(null, 'All');
  });

  it('shows unique services plus All when several queues are available', async () => {
    const user = userEvent.setup();
    mockQueueResult([
      mockQueueTriage,
      { ...mockQueueTriage, uuid: 'duplicate-triage-queue' },
      mockQueueSurgery,
    ]);

    render(<PatientQueueHeader showFilters />);

    await user.click(screen.getByRole('combobox', { name: /select a service/i }));

    expect(screen.getAllByRole('option')).toHaveLength(3);
    expect(screen.getAllByRole('option', { name: 'Triage' })).toHaveLength(1);
    expect(screen.getAllByRole('option', { name: 'Surgery' })).toHaveLength(1);
    expect(screen.getAllByRole('option', { name: 'All' })).toHaveLength(1);
  });

  it('keeps a valid persisted service selected', () => {
    mockQueueResult([mockQueueTriage]);
    mockUseServiceQueuesStore.mockReturnValue({
      ...defaultStoreState,
      selectedServiceUuid: mockServiceTriage.uuid,
      selectedServiceDisplay: mockServiceTriage.display,
    });

    render(<PatientQueueHeader showFilters />);

    expect(screen.getByRole('combobox', { name: /select a service/i })).toHaveTextContent(mockServiceTriage.display);
    expect(mockUpdateSelectedService).not.toHaveBeenCalled();
  });

  it('shows a disabled service filter and clears an invalid persisted service after a successful empty response', async () => {
    mockUseServiceQueuesStore.mockReturnValue({
      ...defaultStoreState,
      selectedServiceUuid: 'missing-service',
      selectedServiceDisplay: 'Missing service',
    });

    render(<PatientQueueHeader showFilters />);

    expect(screen.getByRole('combobox', { name: /select a service/i })).toBeDisabled();
    await waitFor(() => expect(mockUpdateSelectedService).toHaveBeenCalledWith(null, 'All'));
  });

  it.each([
    { name: 'loading', isLoading: true, error: undefined },
    { name: 'an error', isLoading: false, error: new Error('Unable to load queues') },
  ])('preserves a persisted service during $name', ({ isLoading, error }) => {
    mockQueueResult([], isLoading, error);
    mockUseServiceQueuesStore.mockReturnValue({
      ...defaultStoreState,
      selectedServiceUuid: 'persisted-service',
      selectedServiceDisplay: 'Persisted service',
    });

    render(<PatientQueueHeader showFilters />);

    const serviceDropdown = screen.getByRole('combobox', { name: /select a service/i });
    expect(serviceDropdown).toBeDisabled();
    expect(serviceDropdown).toHaveTextContent('Persisted service');
    expect(mockUpdateSelectedService).not.toHaveBeenCalled();
  });

  it('does not render queue filters when filters are disabled', () => {
    mockQueueResult([mockQueueTriage]);

    render(<PatientQueueHeader showFilters={false} />);

    expect(screen.queryByRole('combobox', { name: /select a service/i })).not.toBeInTheDocument();
  });
});

function mockQueueResult(queues: ReturnType<typeof useQueues>['queues'], isLoading = false, error?: Error) {
  mockUseQueues.mockReturnValue({ queues, isLoading, error } as ReturnType<typeof useQueues>);
}
