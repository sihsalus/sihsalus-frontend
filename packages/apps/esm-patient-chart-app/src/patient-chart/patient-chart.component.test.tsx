import { render, waitFor } from '@testing-library/react';

import PatientChart from './patient-chart.component';

const mockLaunchWorkspaceGroup2 = vi.fn();
const mockSetCurrentVisit = vi.fn();
const mockSetLeftNav = vi.fn();
const mockUnsetLeftNav = vi.fn();
const mockStoreSetState = vi.fn();
const mockMutateVisitContext = vi.fn();
let mockIsLoadingPatient = false;
let mockPatientUuid = 'patient-uuid';
let mockPatient = {
  id: 'patient-uuid',
};
let mockCurrentVisit: { uuid: string } | null = {
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
    patientUuid: mockPatientUuid,
    view: undefined,
  }),
}));

vi.mock('../loader/loader.component', () => ({ default: () => <div>Loading</div> }));
vi.mock('../patient-chart/chart-review/chart-review.component', () => ({ default: () => <div>Chart review</div> }));
vi.mock('../side-nav/side-menu.component', () => ({ default: () => <div>Side menu</div> }));

describe('PatientChart', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLaunchWorkspaceGroup2.mockResolvedValue(true);
    mockIsLoadingPatient = false;
    mockPatientUuid = 'patient-uuid';
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

  it('relaunches the patient-chart workspace group when the visit context changes', async () => {
    const { rerender } = render(<PatientChart />);

    await waitFor(() => {
      expect(mockLaunchWorkspaceGroup2).toHaveBeenCalledTimes(1);
    });

    mockCurrentVisit = {
      uuid: 'updated-visit-uuid',
    };

    rerender(<PatientChart />);

    await waitFor(() => {
      expect(mockLaunchWorkspaceGroup2).toHaveBeenCalledTimes(2);
    });

    expect(mockLaunchWorkspaceGroup2).toHaveBeenLastCalledWith(
      'patient-chart',
      expect.objectContaining({
        patientUuid: 'patient-uuid',
        visitContext: mockCurrentVisit,
        mutateVisitContext: mockMutateVisitContext,
      }),
    );
    expect(mockStoreSetState).toHaveBeenCalledWith(
      expect.objectContaining({
        visitContext: mockCurrentVisit,
      }),
    );
  });

  it('does not relaunch the patient-chart workspace group when the same visit is returned with a new object reference', async () => {
    const { rerender } = render(<PatientChart />);

    await waitFor(() => {
      expect(mockLaunchWorkspaceGroup2).toHaveBeenCalledTimes(1);
    });

    mockCurrentVisit = {
      uuid: 'active-visit-uuid',
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

  it('relaunches the patient-chart workspace group when the patient changes and neither patient has an active visit', async () => {
    mockCurrentVisit = null;
    const { rerender } = render(<PatientChart />);

    await waitFor(() => {
      expect(mockLaunchWorkspaceGroup2).toHaveBeenCalledTimes(1);
    });
    expect(mockLaunchWorkspaceGroup2).toHaveBeenLastCalledWith(
      'patient-chart',
      expect.objectContaining({
        patientUuid: 'patient-uuid',
        visitContext: null,
      }),
    );

    mockPatientUuid = 'other-patient-uuid';
    mockPatient = {
      id: 'other-patient-uuid',
    };

    rerender(<PatientChart />);

    await waitFor(() => {
      expect(mockLaunchWorkspaceGroup2).toHaveBeenCalledTimes(2);
    });
    expect(mockLaunchWorkspaceGroup2).toHaveBeenLastCalledWith(
      'patient-chart',
      expect.objectContaining({
        patientUuid: 'other-patient-uuid',
        visitContext: null,
      }),
    );
  });

  it('launches the latest visit context after a previous launch resolves', async () => {
    let resolveFirstLaunch!: (value: boolean) => void;
    const firstLaunch = new Promise<boolean>((resolve) => {
      resolveFirstLaunch = resolve;
    });
    mockLaunchWorkspaceGroup2.mockReturnValueOnce(firstLaunch).mockResolvedValue(true);

    const { rerender } = render(<PatientChart />);

    await waitFor(() => {
      expect(mockLaunchWorkspaceGroup2).toHaveBeenCalledTimes(1);
    });
    expect(mockLaunchWorkspaceGroup2).toHaveBeenLastCalledWith(
      'patient-chart',
      expect.objectContaining({
        visitContext: mockCurrentVisit,
      }),
    );

    mockCurrentVisit = {
      uuid: 'latest-visit-uuid',
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

    resolveFirstLaunch(true);

    await waitFor(() => {
      expect(mockLaunchWorkspaceGroup2).toHaveBeenCalledTimes(2);
    });
    expect(mockLaunchWorkspaceGroup2).toHaveBeenLastCalledWith(
      'patient-chart',
      expect.objectContaining({
        visitContext: mockCurrentVisit,
      }),
    );
  });
});
