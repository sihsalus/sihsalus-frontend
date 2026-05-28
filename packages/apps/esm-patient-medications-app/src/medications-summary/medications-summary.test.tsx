import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mockFhirPatient } from 'test-utils';

import { useActivePatientOrders, usePastPatientOrders } from '../api';
import MedicationsSummary from './medications-summary.component';

const mockUseActivePatientOrders = vi.mocked(useActivePatientOrders);
const mockUsePastPatientOrders = vi.mocked(usePastPatientOrders);
const mockLaunchWorkspace = vi.fn();

vi.mock('@openmrs/esm-patient-common-lib', async () => {
  const originalModule = await vi.importActual('@openmrs/esm-patient-common-lib');

  return {
    ...originalModule,
    ErrorState: vi.fn(() => null),
    useLaunchWorkspaceRequiringVisit: vi.fn(() => mockLaunchWorkspace),
  };
});

vi.mock('../api', async () => {
  const originalModule = await vi.importActual('../api');

  return {
    ...originalModule,
    useActivePatientOrders: vi.fn(),
    usePastPatientOrders: vi.fn(),
  };
});

describe('MedicationsSummary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseActivePatientOrders.mockReturnValue({
      data: [],
      error: undefined,
      isLoading: false,
      isValidating: false,
    } as ReturnType<typeof useActivePatientOrders>);
    mockUsePastPatientOrders.mockReturnValue({
      data: [],
      error: undefined,
      isLoading: false,
      isValidating: false,
    } as ReturnType<typeof usePastPatientOrders>);
  });

  it('renders record buttons for both empty active and past medication sections', async () => {
    const user = userEvent.setup();

    render(<MedicationsSummary patient={mockFhirPatient} />);

    const recordActiveMedicationButton = screen.getByRole('button', { name: /record active medications/i });
    const recordPastMedicationButton = screen.getByRole('button', { name: /record past medications/i });

    expect(recordActiveMedicationButton).toBeInTheDocument();
    expect(recordPastMedicationButton).toBeInTheDocument();

    await user.click(recordPastMedicationButton);

    expect(mockLaunchWorkspace).toHaveBeenCalledTimes(1);
  });
});
