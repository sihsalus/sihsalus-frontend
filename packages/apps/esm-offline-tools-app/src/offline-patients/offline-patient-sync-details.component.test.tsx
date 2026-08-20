import { getDynamicOfflineDataHandlers } from '@openmrs/esm-framework';
import { render, screen } from '@testing-library/react';
import { type ReactNode } from 'react';

import { useLastSyncStateOfPatient } from '../hooks/offline-patient-data-hooks';

import OfflinePatientSyncDetails from './offline-patient-sync-details.component';

vi.mock('@openmrs/esm-framework', async () => ({
  ...(await vi.importActual('@openmrs/esm-framework')),
  getDynamicOfflineDataHandlers: vi.fn(),
}));

vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual('react-router-dom')),
  useParams: vi.fn(() => ({ patientUuid: 'synthetic-patient-uuid' })),
}));

vi.mock('../components/shared-page-layout.component', () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('../hooks/offline-patient-data-hooks', () => ({
  useLastSyncStateOfPatient: vi.fn(),
}));

const mockGetDynamicOfflineDataHandlers = vi.mocked(getDynamicOfflineDataHandlers);
const mockUseLastSyncStateOfPatient = vi.mocked(useLastSyncStateOfPatient);

describe('OfflinePatientSyncDetails', () => {
  it('renders fixed translated feedback instead of a legacy persisted error message', () => {
    mockGetDynamicOfflineDataHandlers.mockReturnValue([
      {
        id: 'synthetic-handler',
        type: 'patient',
        displayName: 'Patient registration',
        isSynced: vi.fn(),
        sync: vi.fn(),
      },
    ]);
    mockUseLastSyncStateOfPatient.mockReturnValue({
      data: {
        syncedOn: new Date(),
        syncedBy: 'user-uuid',
        succeededHandlers: [],
        erroredHandlers: ['synthetic-handler'],
        errors: [
          {
            handlerId: 'synthetic-handler',
            message: 'GET /patient/private-patient-uuid?name=Private%20Patient failed',
          },
        ],
      },
    } as ReturnType<typeof useLastSyncStateOfPatient>);

    render(<OfflinePatientSyncDetails />);

    expect(screen.getByText('This item could not be downloaded. Try updating the patient again.')).toBeInTheDocument();
    expect(screen.queryByText(/private-patient-uuid|Private%20Patient/)).not.toBeInTheDocument();
  });
});
