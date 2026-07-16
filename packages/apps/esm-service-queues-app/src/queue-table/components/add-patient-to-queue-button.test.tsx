import { launchWorkspace2, useLocations } from '@openmrs/esm-framework';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { PropsWithChildren } from 'react';
import { serviceQueuesPatientSearchWorkspace, serviceQueuesStartVisitWorkspace } from '../../constants';
import { useServiceQueuesStore } from '../../store/store';
import AddPatientToQueueButton from './add-patient-to-queue-button.component';

const mockLaunchWorkspace2 = vi.mocked(launchWorkspace2);
const mockUseLocations = vi.mocked(useLocations);
const mockUseServiceQueuesStore = vi.mocked(useServiceQueuesStore);

vi.mock('../../permissions', () => ({
  CanEditServiceQueues: ({ children }: PropsWithChildren) => children,
}));

vi.mock('../../store/store', () => ({
  useServiceQueuesStore: vi.fn(),
}));

describe('AddPatientToQueueButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseServiceQueuesStore.mockReturnValue({
      selectedQueueLocationName: 'UPSS - CONSULTA EXTERNA',
      selectedQueueLocationUuid: 'queue-location-uuid',
      selectedServiceUuid: 'queue-service-uuid',
    } as ReturnType<typeof useServiceQueuesStore>);
    mockUseLocations.mockReturnValue([
      {
        uuid: 'queue-location-uuid',
        display: 'UPSS - CONSULTA EXTERNA',
      },
    ] as ReturnType<typeof useLocations>);
  });

  it('locks the queue entry and a new visit to the selected operational location', async () => {
    const user = userEvent.setup();
    const launchChildWorkspace = vi.fn();

    render(<AddPatientToQueueButton />);
    await user.click(screen.getByRole('button', { name: /add patient to queue/i }));

    const [, searchWorkspaceProps, launchOptions] = mockLaunchWorkspace2.mock.calls[0];
    searchWorkspaceProps.onPatientSelected(
      'patient-uuid',
      { id: 'patient-uuid' } as fhir.Patient,
      launchChildWorkspace,
      vi.fn(),
    );

    const requiredVisitLocation = {
      uuid: 'queue-location-uuid',
      display: 'UPSS - CONSULTA EXTERNA',
    };
    expect(launchChildWorkspace).toHaveBeenCalledWith(serviceQueuesPatientSearchWorkspace, {
      currentQueueLocationUuid: 'queue-location-uuid',
      currentServiceQueueUuid: 'queue-service-uuid',
      patient: expect.objectContaining({ id: 'patient-uuid' }),
      requiredVisitLocation,
      selectedPatientUuid: 'patient-uuid',
    });
    expect(launchOptions).toEqual({
      startVisitWorkspaceName: serviceQueuesStartVisitWorkspace,
      startVisitWorkspaceProps: expect.objectContaining({
        currentQueueLocationUuid: 'queue-location-uuid',
        currentServiceQueueUuid: 'queue-service-uuid',
        requiredVisitLocation,
      }),
    });
  });

  it('requires an operational Visit Location before adding a patient', () => {
    mockUseServiceQueuesStore.mockReturnValue({
      selectedQueueLocationName: 'Hospital Santa Clotilde',
      selectedQueueLocationUuid: 'hospital-uuid',
      selectedServiceUuid: null,
    } as ReturnType<typeof useServiceQueuesStore>);

    render(<AddPatientToQueueButton />);

    expect(screen.getByRole('button', { name: /add patient to queue/i })).toBeDisabled();
  });
});
