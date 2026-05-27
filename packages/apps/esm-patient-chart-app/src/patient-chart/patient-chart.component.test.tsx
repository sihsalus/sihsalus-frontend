import { render, waitFor } from '@testing-library/react';

import PatientChart from './patient-chart.component';

const mockLaunchWorkspaceGroup2 = vi.fn();
const mockSetCurrentVisit = vi.fn();
const mockSetLeftNav = vi.fn();
const mockUnsetLeftNav = vi.fn();
const mockStoreSetState = vi.fn();
const mockMutateVisitContext = vi.fn();
let mockIsLoadingPatient = false;
let mockPatient = {
  id: 'patient-uuid',
};
let mockCurrentVisit = {
  uuid: 'active-visit-uuid',
};

vi.mock('@openmrs/esm-framework', async () => ({
  ...(await vi.importActual('@openmrs/esm-framework')),
  ExtensionSlot: () => null,
  setCurrentVisit: (...args: Array<unknown>) => mockSetCurrentVisit(...args),
  setLeftNav: (...args: Array<unknown>) => mockSetLeftNav(...args),
  unsetLeftNav: (...args: Array<unknown>) => mockUnsetLeftNav(...args),
  usePatient: () => ({
    isLoading: mockIsLoadingPatient,
    patient: mockPatient,
  }),
}));

vi.mock('@openmrs/esm-styleguide', () => ({
  WorkspaceContainer: () => null,
  launchWorkspaceGroup2: (...args: Array<unknown>) => mockLaunchWorkspaceGroup2(...args),
  useWorkspaces: () => ({
    workspaceWindowState: 'hidden',
    active: false,
  }),
}));

vi.mock('@openmrs/esm-patient-common-lib', async () => ({
  ...(await vi.importActual('@openmrs/esm-patient-common-lib')),
  getPatientChartStore: () => ({
    setState: mockStoreSetState,
  }),
  useVisitOrOfflineVisit: () => ({
    currentVisit: mockCurrentVisit,
    mutate: mockMutateVisitContext,
  }),
}));

vi.mock('react-router-dom', () => ({
  useParams: () => ({
    patientUuid: 'patient-uuid',
    view: undefined,
  }),
}));

vi.mock('../loader/loader.component', () => ({ default: () => <div>Loading</div> }));
vi.mock('../patient-chart/chart-review/chart-review.component', () => ({ default: () => <div>Chart review</div> }));
vi.mock('../side-nav/side-menu.component', () => ({ default: () => <div>Side menu</div> }));

describe('PatientChart', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsLoadingPatient = false;
    mockPatient = {
      id: 'patient-uuid',
    };
    mockCurrentVisit = {
      uuid: 'active-visit-uuid',
    };
  });

  it('launches the patient-chart workspace group with the active visit context', async () => {
    render(<PatientChart />);

    await waitFor(() => {
      expect(mockLaunchWorkspaceGroup2).toHaveBeenCalledWith(
        'patient-chart',
        expect.objectContaining({
          patientUuid: 'patient-uuid',
          visitContext: mockCurrentVisit,
          mutateVisitContext: mockMutateVisitContext,
        }),
      );
    });

    expect(mockStoreSetState).toHaveBeenCalledWith(
      expect.objectContaining({
        patientUuid: 'patient-uuid',
        visitContext: mockCurrentVisit,
        mutateVisitContext: mockMutateVisitContext,
      }),
    );
  });

  it('does not relaunch the patient-chart workspace group when visit context finishes loading', async () => {
    const { rerender } = render(<PatientChart />);

    await waitFor(() => {
      expect(mockLaunchWorkspaceGroup2).toHaveBeenCalledTimes(1);
    });

    mockCurrentVisit = {
      uuid: 'updated-visit-uuid',
    };

    rerender(<PatientChart />);

    await waitFor(() => {
      expect(mockStoreSetState).toHaveBeenCalledWith(
        expect.objectContaining({
          visitContext: mockCurrentVisit,
        }),
      );
    });

    expect(mockLaunchWorkspaceGroup2).toHaveBeenCalledTimes(1);
  });
});
