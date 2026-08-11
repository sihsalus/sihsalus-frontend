import { getDefaultsFromConfigSchema, useConfig, useSession } from '@openmrs/esm-framework';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mockQueueSurgery, mockQueueTriage, mockServiceTriage } from 'test-utils';

import { type ConfigObject, configSchema } from '../config-schema';
import { useQueueLocations } from '../create-queue-entry/hooks/useQueueLocations';
import { useQueues } from '../hooks/useQueues';
import {
  updateSelectedQueueLocationName,
  updateSelectedQueueLocationUuid,
  updateSelectedService,
  useServiceQueuesStore,
} from '../store/store';
import PatientQueueHeader, { isUpssQueueLocation } from './patient-queue-header.component';

const mockUseConfig = vi.mocked(useConfig<ConfigObject>);
const mockUseSession = vi.mocked(useSession);
const mockUseQueueLocations = vi.mocked(useQueueLocations);
const mockUseQueues = vi.mocked(useQueues);
const mockUpdateSelectedQueueLocationName = vi.mocked(updateSelectedQueueLocationName);
const mockUpdateSelectedQueueLocationUuid = vi.mocked(updateSelectedQueueLocationUuid);
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
  queueLocationSelectionInitialized: false,
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
    mockSession();
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
    mockQueueResult([mockQueueTriage, { ...mockQueueTriage, uuid: 'duplicate-triage-queue' }, mockQueueSurgery]);

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

  it('does not let a role name or session location override a valid persisted Queue Location', () => {
    const sessionQueueLocation = {
      resourceType: 'Location' as const,
      id: 'admission-location',
      name: 'UPSS - ADMISIÓN',
    };
    mockSession('SIHSALUS Admision', { uuid: sessionQueueLocation.id, display: 'Stale session display' });
    mockUseQueueLocations.mockReturnValue({
      queueLocations: [
        sessionQueueLocation,
        { resourceType: 'Location', id: 'other-location', name: 'UPSS - CONSULTA EXTERNA' },
      ],
      isLoading: false,
      error: undefined,
    });
    mockUseServiceQueuesStore.mockReturnValue({
      ...defaultStoreState,
      queueLocationSelectionInitialized: true,
      selectedQueueLocationUuid: 'other-location',
      selectedQueueLocationName: 'UPSS - CONSULTA EXTERNA',
      selectedServiceUuid: mockServiceTriage.uuid,
      selectedServiceDisplay: mockServiceTriage.display,
    });
    mockQueueResult([mockQueueTriage]);

    render(<PatientQueueHeader showFilters />);

    expect(screen.getByRole('combobox', { name: /select a queue UPSS/i })).toBeEnabled();
    expect(mockUseQueues).toHaveBeenCalledWith('other-location');
    expect(mockUpdateSelectedQueueLocationUuid).not.toHaveBeenCalled();
    expect(mockUpdateSelectedQueueLocationName).not.toHaveBeenCalled();
  });

  it('keeps an explicit All UPSS selection instead of restoring the session location', () => {
    const sessionQueueLocation = {
      resourceType: 'Location' as const,
      id: 'hospital-location',
      name: 'Hospital Santa Clotilde',
    };
    mockSession('Super User', { uuid: sessionQueueLocation.id, display: sessionQueueLocation.name });
    mockUseQueueLocations.mockReturnValue({
      queueLocations: [
        sessionQueueLocation,
        { resourceType: 'Location', id: 'outpatient-location', name: 'UPSS - CONSULTA EXTERNA' },
        { resourceType: 'Location', id: 'obstetric-location', name: 'UPSS - CENTRO OBSTÉTRICO' },
      ],
      isLoading: false,
      error: undefined,
    });
    mockUseServiceQueuesStore.mockReturnValue({
      ...defaultStoreState,
      queueLocationSelectionInitialized: true,
      selectedQueueLocationName: null,
      selectedQueueLocationUuid: null,
    });

    render(<PatientQueueHeader showFilters />);

    expect(screen.getByRole('combobox', { name: /select a queue UPSS/i })).toHaveTextContent('All');
    expect(mockUseQueues).toHaveBeenCalledWith(null);
    expect(mockUpdateSelectedQueueLocationUuid).not.toHaveBeenCalled();
    expect(mockUpdateSelectedQueueLocationName).not.toHaveBeenCalled();
  });

  it('stores All as an explicit UPSS selection', async () => {
    const user = userEvent.setup();
    const outpatientLocation = {
      resourceType: 'Location' as const,
      id: 'outpatient-location',
      name: 'UPSS - CONSULTA EXTERNA',
    };
    mockUseQueueLocations.mockReturnValue({
      queueLocations: [
        outpatientLocation,
        { resourceType: 'Location', id: 'obstetric-location', name: 'UPSS - CENTRO OBSTÉTRICO' },
      ],
      isLoading: false,
      error: undefined,
    });
    mockUseServiceQueuesStore.mockReturnValue({
      ...defaultStoreState,
      queueLocationSelectionInitialized: true,
      selectedQueueLocationName: outpatientLocation.name,
      selectedQueueLocationUuid: outpatientLocation.id,
    });

    render(<PatientQueueHeader showFilters />);

    await user.click(screen.getByRole('combobox', { name: /select a queue UPSS/i }));
    await user.click(screen.getByRole('option', { name: 'All' }));

    expect(mockUpdateSelectedQueueLocationUuid).toHaveBeenCalledWith(null);
    expect(mockUpdateSelectedQueueLocationName).toHaveBeenCalledWith(null);
    expect(mockUpdateSelectedService).toHaveBeenCalledWith(null, 'All');
  });

  it('defaults an uninitialized UPSS selection to All instead of the physical session location', () => {
    const sessionQueueLocation = {
      resourceType: 'Location' as const,
      id: 'hospital-location',
      name: 'Hospital Santa Clotilde',
    };
    mockSession('Super User', { uuid: sessionQueueLocation.id, display: sessionQueueLocation.name });
    mockUseQueueLocations.mockReturnValue({
      queueLocations: [
        sessionQueueLocation,
        { resourceType: 'Location', id: 'outpatient-location', name: 'UPSS - CONSULTA EXTERNA' },
      ],
      isLoading: false,
      error: undefined,
    });

    render(<PatientQueueHeader showFilters />);

    expect(mockUseQueues).toHaveBeenCalledWith(null);
    expect(mockUpdateSelectedQueueLocationUuid).toHaveBeenCalledOnce();
    expect(mockUpdateSelectedQueueLocationUuid).toHaveBeenCalledWith(null);
    expect(mockUpdateSelectedQueueLocationName).toHaveBeenCalledOnce();
    expect(mockUpdateSelectedQueueLocationName).toHaveBeenCalledWith(null);
  });

  it('clears a stale persisted Queue Location after metadata loads successfully', async () => {
    mockSession('Any role', { uuid: 'non-queue-location', display: 'Unconfigured location' });
    mockUseQueueLocations.mockReturnValue({
      queueLocations: [{ resourceType: 'Location', id: 'queue-location', name: 'UPSS - CONSULTA EXTERNA' }],
      isLoading: false,
      error: undefined,
    });
    mockUseServiceQueuesStore.mockReturnValue({
      ...defaultStoreState,
      selectedQueueLocationUuid: 'persisted-location',
      selectedQueueLocationName: 'Persisted location',
    });

    render(<PatientQueueHeader showFilters />);

    expect(screen.queryByRole('combobox', { name: /select a queue UPSS/i })).not.toBeInTheDocument();
    await waitFor(() => {
      expect(mockUpdateSelectedQueueLocationUuid).toHaveBeenCalledWith(null);
      expect(mockUpdateSelectedQueueLocationName).toHaveBeenCalledWith(null);
    });
  });

  it('preserves persisted Queue Location state while metadata loading fails', () => {
    mockSession('Any role', { uuid: 'admission-location', display: 'Admission desk' });
    mockUseQueueLocations.mockReturnValue({
      queueLocations: [],
      isLoading: false,
      error: new Error('FHIR request failed'),
    });
    mockUseServiceQueuesStore.mockReturnValue({
      ...defaultStoreState,
      selectedQueueLocationUuid: 'persisted-location',
      selectedQueueLocationName: 'Persisted location',
    });

    render(<PatientQueueHeader showFilters />);

    expect(screen.getByText('Failed to load UPSS')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /select a service/i })).toBeDisabled();
    expect(mockUpdateSelectedQueueLocationUuid).not.toHaveBeenCalled();
    expect(mockUpdateSelectedQueueLocationName).not.toHaveBeenCalled();
  });

  it('keeps the location filter behavior independent from role names', () => {
    mockSession('SIHSALUS Admision', { uuid: 'queue-location-1', display: 'Queue location 1' });
    mockUseQueueLocations.mockReturnValue({
      queueLocations: [
        { resourceType: 'Location', id: 'queue-location-1', name: 'UPSS - CONSULTA EXTERNA' },
        { resourceType: 'Location', id: 'queue-location-2', name: 'UPSS - CENTRO OBSTÉTRICO' },
      ],
      isLoading: false,
      error: undefined,
    });

    render(<PatientQueueHeader showFilters />);

    expect(screen.getByRole('combobox', { name: /select a queue UPSS/i })).toBeEnabled();
  });

  it('shows only UPSS options and excludes physical facilities from the filter', async () => {
    const user = userEvent.setup();
    mockUseQueueLocations.mockReturnValue({
      queueLocations: [
        { resourceType: 'Location', id: 'hospital-location', name: 'Hospital Santa Clotilde' },
        { resourceType: 'Location', id: 'casita-location', name: 'Casita Azul' },
        { resourceType: 'Location', id: 'outpatient-location', name: 'UPSS - CONSULTA EXTERNA' },
        { resourceType: 'Location', id: 'obstetric-location', name: 'UPSS - CENTRO OBSTÉTRICO' },
      ],
      isLoading: false,
      error: undefined,
    });

    render(<PatientQueueHeader showFilters />);

    const upssDropdown = screen.getByRole('combobox', { name: /select a queue UPSS/i });
    expect(upssDropdown).toHaveTextContent('All');
    await user.click(upssDropdown);
    expect(screen.getByRole('option', { name: 'All' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'UPSS - CONSULTA EXTERNA' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'UPSS - CENTRO OBSTÉTRICO' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Hospital Santa Clotilde' })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Casita Azul' })).not.toBeInTheDocument();
  });
});

describe('isUpssQueueLocation', () => {
  it.each([
    { resourceType: 'Location', name: 'UPSS - CONSULTA EXTERNA' },
    { resourceType: 'Location', name: 'Consulta externa', meta: { tag: [{ code: 'UPSS' }] } },
  ] as Array<fhir.Location>)('recognizes an UPSS by its canonical name or metadata', (location) => {
    expect(isUpssQueueLocation(location)).toBe(true);
  });

  it.each([
    { resourceType: 'Location', name: 'Hospital Santa Clotilde' },
    { resourceType: 'Location', name: 'Casita Azul' },
  ] as Array<fhir.Location>)('does not classify a physical facility as an UPSS', (location) => {
    expect(isUpssQueueLocation(location)).toBe(false);
  });
});

function mockQueueResult(queues: ReturnType<typeof useQueues>['queues'], isLoading = false, error?: Error) {
  mockUseQueues.mockReturnValue({ queues, isLoading, error } as ReturnType<typeof useQueues>);
}

function mockSession(roleName = 'Nurse', sessionLocation?: { uuid: string; display: string }) {
  mockUseSession.mockReturnValue({
    authenticated: true,
    user: {
      roles: [{ display: roleName }],
    },
    sessionLocation,
  } as unknown as ReturnType<typeof useSession>);
}
