import { ExtensionSlot, launchWorkspace, useSession } from '@openmrs/esm-framework';
import { render } from '@testing-library/react';
import { mockQueueTriage } from 'test-utils';

import { useQueueLocations } from '../create-queue-entry/hooks/useQueueLocations';
import type { Queue } from '../types';
import QueueTablesForAllStatuses from './queue-tables-for-all-statuses.component';

const mockExtensionSlot = vi.mocked(ExtensionSlot);
const mockLaunchWorkspace = vi.mocked(launchWorkspace);
const mockUseQueueLocations = vi.mocked(useQueueLocations);
const mockUseSession = vi.mocked(useSession);

vi.mock('../create-queue-entry/hooks/useQueueLocations', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../create-queue-entry/hooks/useQueueLocations')>()),
  useQueueLocations: vi.fn(),
}));

vi.mock('../permissions', () => ({
  canEditServiceQueues: vi.fn(() => true),
}));

vi.mock('../hooks/useQueueEntries', () => ({
  useQueueEntries: vi.fn(() => ({
    queueEntries: [],
    isLoading: true,
    isValidating: false,
  })),
}));

vi.mock('../patient-queue-header/patient-queue-header.component', () => ({
  default: ({ actions }: { actions: React.ReactNode }) => <>{actions}</>,
}));

vi.mock('../queue-table/queue-table-metrics.component', () => ({
  default: () => null,
}));

type PatientSearchExtensionState = {
  buttonText: string;
  buttonProps: { 'aria-busy': boolean; disabled: boolean; title?: string };
  selectPatientAction: (patientUuid: string) => void;
};

const selectedQueue = {
  ...mockQueueTriage,
  uuid: 'queue-uuid',
  location: {
    uuid: 'queue-location-uuid',
    display: 'Queue location fallback name',
  },
  allowedStatuses: [],
} satisfies Queue;

describe('QueueTablesForAllStatuses queue location semantics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSession.mockReturnValue({
      authenticated: true,
      sessionLocation: { uuid: 'queue-location-uuid' },
      user: { roles: [{ display: 'Nurse' }] },
    } as unknown as ReturnType<typeof useSession>);
  });

  it('allows adding to a queue-only location without requiring a visit location', () => {
    mockUseQueueLocations.mockReturnValue({
      queueLocations: [
        {
          resourceType: 'Location',
          id: 'queue-location-uuid',
          name: 'Hospital Santa Clotilde',
          meta: { tag: [{ code: 'Queue Location' }] },
        },
      ],
      isLoading: false,
      error: undefined,
    });

    renderView();
    const extensionState = getPatientSearchExtensionState();

    expect(extensionState.buttonProps.disabled).toBe(false);
    extensionState.selectPatientAction('patient-uuid');
    expect(mockLaunchWorkspace).toHaveBeenCalledWith('create-queue-entry-workspace', {
      selectedPatientUuid: 'patient-uuid',
      currentServiceQueueUuid: 'queue-uuid',
      currentQueueLocationUuid: 'queue-location-uuid',
      requiredVisitLocation: undefined,
    });
  });

  it('derives the required visit location when the queue location is also a Visit Location', () => {
    mockUseQueueLocations.mockReturnValue({
      queueLocations: [
        {
          resourceType: 'Location',
          id: 'queue-location-uuid',
          name: 'UPSS - Consulta externa',
          meta: { tag: [{ code: 'Queue Location' }, { code: 'Visit Location' }] },
        },
      ],
      isLoading: false,
      error: undefined,
    });

    renderView();
    const extensionState = getPatientSearchExtensionState();

    expect(extensionState.buttonProps.disabled).toBe(false);
    extensionState.selectPatientAction('patient-uuid');
    expect(mockLaunchWorkspace).toHaveBeenCalledWith('create-queue-entry-workspace', {
      selectedPatientUuid: 'patient-uuid',
      currentServiceQueueUuid: 'queue-uuid',
      currentQueueLocationUuid: 'queue-location-uuid',
      requiredVisitLocation: {
        uuid: 'queue-location-uuid',
        display: 'UPSS - Consulta externa',
      },
    });
  });

  it('uses the selected queue location instead of the session location for a direct URL', () => {
    mockUseSession.mockReturnValue({
      authenticated: true,
      sessionLocation: { uuid: 'another-session-location' },
      user: { roles: [{ display: 'Any role' }] },
    } as unknown as ReturnType<typeof useSession>);
    mockUseQueueLocations.mockReturnValue({
      queueLocations: [
        {
          resourceType: 'Location',
          id: 'queue-location-uuid',
          name: 'Queue at another location',
          meta: { tag: [{ code: 'Queue Location' }] },
        },
      ],
      isLoading: false,
      error: undefined,
    });

    renderView();
    const extensionState = getPatientSearchExtensionState();

    expect(extensionState.buttonProps.disabled).toBe(false);
    extensionState.selectPatientAction('patient-uuid');
    expect(mockLaunchWorkspace).toHaveBeenCalledWith('create-queue-entry-workspace', {
      selectedPatientUuid: 'patient-uuid',
      currentServiceQueueUuid: 'queue-uuid',
      currentQueueLocationUuid: 'queue-location-uuid',
      requiredVisitLocation: undefined,
    });
  });

  it.each([
    {
      scenario: 'queue locations are loading',
      result: { queueLocations: [], isLoading: true, error: undefined },
      expectedText: 'Loading queues…',
      expectedBusy: true,
    },
    {
      scenario: 'queue location loading failed',
      result: { queueLocations: [], isLoading: false, error: new Error('FHIR request failed') },
      expectedText: 'Queues are temporarily unavailable',
      expectedBusy: false,
    },
    {
      scenario: 'the selected queue location is missing from FHIR metadata',
      result: {
        queueLocations: [
          {
            resourceType: 'Location' as const,
            id: 'another-location-uuid',
            name: 'Another location',
            meta: { tag: [{ code: 'Queue Location' }] },
          },
        ],
        isLoading: false,
        error: undefined,
      },
      expectedText: 'This queue location is not available',
      expectedBusy: false,
    },
  ])('fails closed with a visible reason when $scenario', ({ result, expectedText, expectedBusy }) => {
    mockUseQueueLocations.mockReturnValue(result);

    renderView();
    const extensionState = getPatientSearchExtensionState();

    expect(extensionState.buttonProps.disabled).toBe(true);
    expect(extensionState.buttonProps['aria-busy']).toBe(expectedBusy);
    expect(extensionState.buttonProps.title).toBe(expectedText);
    expect(extensionState.buttonText).toBe(expectedText);
    extensionState.selectPatientAction('patient-uuid');
    expect(mockLaunchWorkspace).not.toHaveBeenCalled();
  });
});

function renderView() {
  return render(
    <QueueTablesForAllStatuses selectedQueue={selectedQueue} isLoadingQueue={false} errorFetchingQueue={undefined} />,
  );
}

function getPatientSearchExtensionState(): PatientSearchExtensionState {
  const call = mockExtensionSlot.mock.calls.find(([props]) => props.name === 'patient-search-button-slot');
  expect(call).toBeDefined();
  return call?.[0].state as PatientSearchExtensionState;
}
