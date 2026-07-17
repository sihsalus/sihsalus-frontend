import { launchWorkspace2, type Workspace2DefinitionProps } from '@openmrs/esm-framework';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { PropsWithChildren } from 'react';
import { serviceQueuesPatientSearchWorkspace, serviceQueuesStartVisitWorkspace } from '../../constants';
import { useQueueLocations } from '../../create-queue-entry/hooks/useQueueLocations';
import { useQueues } from '../../hooks/useQueues';
import { useServiceQueuesStore } from '../../store/store';
import type { Queue } from '../../types';
import AddPatientToQueueButton from './add-patient-to-queue-button.component';

const mockLaunchWorkspace2 = vi.mocked(launchWorkspace2);
const mockUseQueueLocations = vi.mocked(useQueueLocations);
const mockUseQueues = vi.mocked(useQueues);
const mockUseServiceQueuesStore = vi.mocked(useServiceQueuesStore);

vi.mock('../../permissions', () => ({
  CanEditServiceQueues: ({ children }: PropsWithChildren) => children,
}));

vi.mock('../../store/store', () => ({
  useServiceQueuesStore: vi.fn(),
}));

vi.mock('../../create-queue-entry/hooks/useQueueLocations', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../create-queue-entry/hooks/useQueueLocations')>()),
  useQueueLocations: vi.fn(),
}));

vi.mock('../../hooks/useQueues', () => ({
  useQueues: vi.fn(),
}));

const queueForService = (uuid: string, serviceUuid: string) =>
  ({
    uuid,
    service: { uuid: serviceUuid },
  }) as Queue;

describe('AddPatientToQueueButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseServiceQueuesStore.mockReturnValue({
      selectedQueueLocationName: 'UPSS - CONSULTA EXTERNA',
      selectedQueueLocationUuid: 'queue-location-uuid',
      selectedServiceUuid: 'service-concept-uuid',
    } as ReturnType<typeof useServiceQueuesStore>);
    mockUseQueueLocations.mockReturnValue({
      queueLocations: [
        {
          resourceType: 'Location',
          id: 'queue-location-uuid',
          name: 'UPSS - CONSULTA EXTERNA',
          meta: { tag: [{ code: 'Queue Location' }, { code: 'Visit Location' }] },
        },
      ],
      isLoading: false,
      error: undefined,
    });
    mockUseQueues.mockReturnValue({
      queues: [queueForService('queue-uuid', 'service-concept-uuid')],
      isLoading: false,
    } as ReturnType<typeof useQueues>);
  });

  it('resolves the selected service concept to its unique queue and locks a new visit to a clinical location', async () => {
    const user = userEvent.setup();
    const launchChildWorkspace = vi.fn();

    render(<AddPatientToQueueButton />);
    await user.click(screen.getByRole('button', { name: /add patient to queue/i }));

    const [, searchWorkspaceProps, launchOptions] = mockLaunchWorkspace2.mock.calls[0];
    const { onPatientSelected } = searchWorkspaceProps as {
      onPatientSelected: (
        patientUuid: string,
        patient: fhir.Patient,
        launchChildWorkspace: Workspace2DefinitionProps['launchChildWorkspace'],
        closeWorkspace: Workspace2DefinitionProps['closeWorkspace'],
      ) => void;
    };
    onPatientSelected('patient-uuid', { id: 'patient-uuid' } as fhir.Patient, launchChildWorkspace, vi.fn());

    const requiredVisitLocation = {
      uuid: 'queue-location-uuid',
      display: 'UPSS - CONSULTA EXTERNA',
    };
    expect(launchChildWorkspace).toHaveBeenCalledWith(serviceQueuesPatientSearchWorkspace, {
      currentQueueLocationUuid: 'queue-location-uuid',
      currentServiceQueueUuid: 'queue-uuid',
      patient: expect.objectContaining({ id: 'patient-uuid' }),
      requiredVisitLocation,
      selectedPatientUuid: 'patient-uuid',
    });
    expect(launchOptions).toEqual({
      startVisitWorkspaceName: serviceQueuesStartVisitWorkspace,
      startVisitWorkspaceProps: expect.objectContaining({
        currentQueueLocationUuid: 'queue-location-uuid',
        currentServiceQueueUuid: 'queue-uuid',
        requiredVisitLocation,
      }),
    });
  });

  it('allows adding a patient to a queue-only location without forcing a visit location', async () => {
    const user = userEvent.setup();
    mockUseServiceQueuesStore.mockReturnValue({
      selectedQueueLocationName: 'Hospital Santa Clotilde',
      selectedQueueLocationUuid: 'hospital-uuid',
      selectedServiceUuid: 'admission-service-concept-uuid',
    } as ReturnType<typeof useServiceQueuesStore>);
    mockUseQueueLocations.mockReturnValue({
      queueLocations: [
        {
          resourceType: 'Location',
          id: 'hospital-uuid',
          name: 'Hospital Santa Clotilde',
          meta: { tag: [{ code: 'Queue Location' }] },
        },
      ],
      isLoading: false,
      error: undefined,
    });
    mockUseQueues.mockReturnValue({
      queues: [queueForService('admission-queue-uuid', 'admission-service-concept-uuid')],
      isLoading: false,
    } as ReturnType<typeof useQueues>);

    render(<AddPatientToQueueButton />);

    const button = screen.getByRole('button', { name: /add patient to queue/i });
    expect(button).toBeEnabled();
    await user.click(button);

    expect(mockLaunchWorkspace2).toHaveBeenCalledWith(
      'queue-patient-search-workspace',
      expect.any(Object),
      expect.objectContaining({
        startVisitWorkspaceProps: expect.objectContaining({
          currentQueueLocationUuid: 'hospital-uuid',
          currentServiceQueueUuid: 'admission-queue-uuid',
          requiredVisitLocation: undefined,
        }),
      }),
    );
  });

  it('does not preselect a queue when multiple queues use the selected service concept', async () => {
    const user = userEvent.setup();
    mockUseQueues.mockReturnValue({
      queues: [
        queueForService('first-queue-uuid', 'service-concept-uuid'),
        queueForService('second-queue-uuid', 'service-concept-uuid'),
      ],
      isLoading: false,
    } as ReturnType<typeof useQueues>);

    render(<AddPatientToQueueButton />);
    await user.click(screen.getByRole('button', { name: /add patient to queue/i }));

    expect(mockLaunchWorkspace2).toHaveBeenCalledWith(
      'queue-patient-search-workspace',
      expect.any(Object),
      expect.objectContaining({
        startVisitWorkspaceProps: expect.objectContaining({ currentServiceQueueUuid: undefined }),
      }),
    );
  });

  it('requires a concrete queue location before adding a patient', () => {
    mockUseServiceQueuesStore.mockReturnValue({
      selectedQueueLocationName: null,
      selectedQueueLocationUuid: null,
      selectedServiceUuid: null,
    } as ReturnType<typeof useServiceQueuesStore>);

    render(<AddPatientToQueueButton />);

    expect(screen.getByRole('button', { name: /select an available queue location/i })).toBeDisabled();
  });

  it('fails closed while the selected queue location metadata is loading', () => {
    mockUseQueueLocations.mockReturnValue({
      queueLocations: [],
      isLoading: true,
      error: undefined,
    });

    render(<AddPatientToQueueButton />);

    const button = screen.getByRole('button', { name: /loading queues/i });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
  });

  it('fails closed when the selected UUID is not an authoritative Queue Location', () => {
    mockUseQueueLocations.mockReturnValue({
      queueLocations: [],
      isLoading: false,
      error: new Error('Unable to load queue locations'),
    });

    render(<AddPatientToQueueButton />);

    expect(screen.getByRole('button', { name: /queues are temporarily unavailable/i })).toBeDisabled();
  });

  it('waits for the selected service to resolve to a queue', () => {
    mockUseQueues.mockReturnValue({
      queues: [],
      isLoading: true,
      error: undefined,
    } as ReturnType<typeof useQueues>);

    render(<AddPatientToQueueButton />);

    const button = screen.getByRole('button', { name: /loading queues/i });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
  });

  it('shows when the selected service cannot be loaded', () => {
    mockUseQueues.mockReturnValue({
      queues: [],
      isLoading: false,
      error: new Error('Unable to load queues'),
    } as ReturnType<typeof useQueues>);

    render(<AddPatientToQueueButton />);

    expect(screen.getByRole('button', { name: /queues are temporarily unavailable/i })).toBeDisabled();
  });

  it('shows when the selected service is unavailable at the authoritative location', () => {
    mockUseQueues.mockReturnValue({
      queues: [queueForService('other-queue-uuid', 'other-service-concept-uuid')],
      isLoading: false,
      error: undefined,
    } as ReturnType<typeof useQueues>);

    render(<AddPatientToQueueButton />);

    expect(screen.getByRole('button', { name: /selected service is not available/i })).toBeDisabled();
  });
});
