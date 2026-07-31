import { render, waitFor } from '@testing-library/react';
import { StrictMode } from 'react';

const { mockAuditLog } = vi.hoisted(() => ({ mockAuditLog: vi.fn() }));

import PatientChart from './patient-chart.component';

const mockLaunchWorkspaceGroup2 = vi.fn();
const mockSetCurrentVisit = vi.fn();
const mockSetLeftNav = vi.fn();
const mockUnsetLeftNav = vi.fn();
const mockStoreSetState = vi.fn();
const mockMutateVisitContext = vi.fn();
let mockIsLoadingPatient = false;
let mockPatientUuid = 'patient-uuid';
let mockPatient: { id: string } | null | undefined = {
  id: 'patient-uuid',
};
let mockView: string | undefined;
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

vi.mock('@sihsalus/esm-audit-logger', () => ({
  useAuditLogger: () => mockAuditLog,
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
    view: mockView,
  }),
}));

vi.mock('../loader/loader.component', () => ({ default: () => <div>Loading</div> }));
vi.mock('../patient-chart/chart-review/chart-review.component', () => ({ default: () => <div>Chart review</div> }));

describe('PatientChart', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLaunchWorkspaceGroup2.mockResolvedValue(true);
    mockAuditLog.mockResolvedValue(undefined);
    mockIsLoadingPatient = false;
    mockPatientUuid = 'patient-uuid';
    mockPatient = {
      id: 'patient-uuid',
    };
    mockView = undefined;
    mockCurrentVisit = {
      uuid: 'active-visit-uuid',
    };
  });

  it('audits access to the patient chart without including patient demographics', async () => {
    render(<PatientChart />);

    await waitFor(() => {
      expect(mockAuditLog).toHaveBeenCalledWith({
        eventType: 'PATIENT_CHART_VIEW_SUCCEEDED',
        patientUuid: 'patient-uuid',
        resourceType: 'Patient',
        metadata: {
          moduleName: '@sihsalus/esm-patient-chart-app',
          outcome: 'succeeded',
        },
      });
    });
    expect(mockAuditLog).toHaveBeenCalledTimes(1);
  });

  it('does not copy a free-text chart segment into audit metadata', async () => {
    mockPatientUuid = '4d7ae11d-076c-4d09-8f7b-8b25ad41c04b';
    mockPatient = { id: mockPatientUuid };
    mockView = encodeURIComponent('Juan Perez 00000002');
    window.history.pushState({}, 'Patient chart', '/chart/Juan Perez 00000002');

    render(<PatientChart />);

    await waitFor(() => {
      expect(mockAuditLog).toHaveBeenCalledWith({
        eventType: 'PATIENT_CHART_VIEW_SUCCEEDED',
        patientUuid: '4d7ae11d-076c-4d09-8f7b-8b25ad41c04b',
        resourceType: 'Patient',
        metadata: {
          moduleName: '@sihsalus/esm-patient-chart-app',
          outcome: 'succeeded',
        },
      });
    });
    expect(JSON.stringify(mockAuditLog.mock.calls)).not.toContain('Juan Perez');
    expect(JSON.stringify(mockAuditLog.mock.calls)).not.toContain('00000002');
  });

  it.each([
    ['undefined', undefined],
    ['null', null],
  ])('audits a patient response of %s without an error as one failed view', async (_label, patient) => {
    mockPatientUuid = '4d7ae11d-076c-4d09-8f7b-8b25ad41c04b';
    mockPatient = patient;

    const { rerender } = render(
      <StrictMode>
        <PatientChart />
      </StrictMode>,
    );

    await waitFor(() => {
      expect(mockAuditLog).toHaveBeenCalledWith({
        eventType: 'PATIENT_CHART_VIEW_FAILED',
        patientUuid: '4d7ae11d-076c-4d09-8f7b-8b25ad41c04b',
        resourceType: 'Patient',
        metadata: {
          moduleName: '@sihsalus/esm-patient-chart-app',
          outcome: 'failed',
        },
      });
    });

    rerender(
      <StrictMode>
        <PatientChart />
      </StrictMode>,
    );
    await waitFor(() => expect(mockAuditLog).toHaveBeenCalledTimes(1));
  });

  // Regression test: useVisit only promotes the active visit into the visit context
  // when the visit store already references the patient, so the chart must point the
  // store at the patient on mount. Without this, currentVisit stays null chart-wide
  // (e.g., "An active visit is required to record vitals and biometrics").
  it('points the visit context store at the patient on mount and clears it on unmount', () => {
    const { unmount } = render(<PatientChart />);

    expect(mockSetCurrentVisit).toHaveBeenCalledWith('patient-uuid', null);

    unmount();

    expect(mockSetCurrentVisit).toHaveBeenLastCalledWith(null, null);
  });

  it('re-points the visit context store when navigating to another patient', () => {
    const { rerender } = render(<PatientChart />);

    expect(mockSetCurrentVisit).toHaveBeenLastCalledWith('patient-uuid', null);

    mockPatientUuid = 'other-patient-uuid';
    mockPatient = {
      id: 'other-patient-uuid',
    };

    rerender(<PatientChart />);

    expect(mockSetCurrentVisit).toHaveBeenLastCalledWith('other-patient-uuid', null);
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
