import { launchWorkspace2, showSnackbar } from '@openmrs/esm-framework';
import { usePatientChartStore } from '@openmrs/esm-patient-common-lib';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useAmbulatoryVisitGuard } from './useAmbulatoryVisitGuard';
import { useConsultaExternaVisitNoteLauncher } from './useConsultaExternaVisitNoteLauncher';

vi.mock('@openmrs/esm-patient-common-lib', async () => {
  const actual = await vi.importActual('@openmrs/esm-patient-common-lib');
  return {
    ...actual,
    usePatientChartStore: vi.fn(),
  };
});

vi.mock('./useAmbulatoryVisitGuard', () => ({
  useAmbulatoryVisitGuard: vi.fn(),
}));

vi.mock('react-i18next', async () => {
  const actual = await vi.importActual('react-i18next');
  return {
    ...actual,
    useTranslation: () => ({
      t: (_key: string, fallback: string) => fallback,
    }),
  };
});

const mockLaunchWorkspace2 = vi.mocked(launchWorkspace2);
const mockShowSnackbar = vi.mocked(showSnackbar);
const mockUsePatientChartStore = vi.mocked(usePatientChartStore);
const mockUseAmbulatoryVisitGuard = vi.mocked(useAmbulatoryVisitGuard);

const patientUuid = 'patient-synthetic-uuid';
const visitUuid = 'visit-synthetic-uuid';
const ambulatoryVisitTypeUuid = 'b1f0e8a1-9c5d-4f0e-8892-81f3140fbc09';
const patient = { id: patientUuid, resourceType: 'Patient' } as fhir.Patient;
const mutateVisitContext = vi.fn();
const activeVisit = {
  uuid: visitUuid,
  startDatetime: '2026-08-23T14:00:00.000-05:00',
  stopDatetime: null,
  visitType: {
    uuid: ambulatoryVisitTypeUuid,
    display: 'Atención Ambulatoria',
  },
  encounters: [],
};

function renderLauncher(mutate: () => unknown = vi.fn()) {
  const hook = renderHook(() =>
    useConsultaExternaVisitNoteLauncher({
      patientUuid,
      ambulatoryVisitTypeUuid,
      mutate,
    }),
  );
  return { ...hook, mutate };
}

describe('useConsultaExternaVisitNoteLauncher', () => {
  const requireAmbulatoryVisit = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    requireAmbulatoryVisit.mockReturnValue(activeVisit);
    mockUseAmbulatoryVisitGuard.mockReturnValue({ requireAmbulatoryVisit });
    mockUsePatientChartStore.mockReturnValue({
      patientUuid,
      patient,
      visitContext: activeVisit,
      mutateVisitContext,
      setPatient: vi.fn(),
      setVisitContext: vi.fn(),
    } as unknown as ReturnType<typeof usePatientChartStore>);
    mockLaunchWorkspace2.mockResolvedValue(true);
  });

  it('does not launch when the outpatient visit guard fails closed', () => {
    requireAmbulatoryVisit.mockReturnValue(null);
    const { result } = renderLauncher();

    act(() => result.current());

    expect(requireAmbulatoryVisit).toHaveBeenCalledOnce();
    expect(mockLaunchWorkspace2).not.toHaveBeenCalled();
  });

  it('launches the centralized visit-note workspace with the exact verified visit and patient-chart context', async () => {
    const { result, mutate } = renderLauncher();

    act(() => result.current());

    await waitFor(() => expect(mockLaunchWorkspace2).toHaveBeenCalledOnce());
    expect(mockUseAmbulatoryVisitGuard).toHaveBeenCalledWith({
      patientUuid,
      ambulatoryVisitTypeUuid,
    });
    expect(mockLaunchWorkspace2).toHaveBeenCalledWith(
      'visit-notes-form-workspace',
      { onAfterSave: expect.any(Function) },
      null,
      {
        patientUuid,
        patient,
        visitContext: activeVisit,
        mutateVisitContext,
      },
    );

    const workspaceProps = mockLaunchWorkspace2.mock.calls[0][1] as {
      onAfterSave: () => unknown;
    };
    await expect(workspaceProps.onAfterSave()).resolves.toBeUndefined();
    expect(mutate).toHaveBeenCalledOnce();
  });

  it('keeps a successful clinical save successful when the history refresh rejects', async () => {
    const mutate = vi.fn().mockRejectedValue(new Error('synthetic refresh failure'));
    const { result } = renderLauncher(mutate);

    act(() => result.current());

    await waitFor(() => expect(mockLaunchWorkspace2).toHaveBeenCalledOnce());
    const workspaceProps = mockLaunchWorkspace2.mock.calls[0][1] as {
      onAfterSave: () => unknown;
    };
    await expect(workspaceProps.onAfterSave()).resolves.toBeUndefined();
    expect(mockShowSnackbar).not.toHaveBeenCalled();
  });

  it('suppresses concurrent clicks while the workspace launch is unresolved', async () => {
    let resolveLaunch: (opened: boolean) => void = () => undefined;
    mockLaunchWorkspace2.mockImplementationOnce(
      () =>
        new Promise<boolean>((resolve) => {
          resolveLaunch = resolve;
        }),
    );
    const { result } = renderLauncher();

    act(() => {
      result.current();
      result.current();
    });

    expect(mockLaunchWorkspace2).toHaveBeenCalledOnce();
    resolveLaunch(true);
    await waitFor(() => expect(requireAmbulatoryVisit).toHaveBeenCalledOnce());
  });

  it.each([
    {
      name: 'the workspace framework rejects',
      arrange: () => mockLaunchWorkspace2.mockRejectedValueOnce(new Error('synthetic framework failure')),
    },
    {
      name: 'the workspace is not opened',
      arrange: () => mockLaunchWorkspace2.mockResolvedValueOnce(false),
    },
  ])('shows a generic error when $name', async ({ arrange }) => {
    arrange();
    const { result } = renderLauncher();

    act(() => result.current());

    await waitFor(() =>
      expect(mockShowSnackbar).toHaveBeenCalledWith({
        isLowContrast: false,
        kind: 'error',
        title: 'Could not open the clinical form',
        subtitle: 'The existing clinical record could not be verified. Reload and try again.',
      }),
    );
  });
});
