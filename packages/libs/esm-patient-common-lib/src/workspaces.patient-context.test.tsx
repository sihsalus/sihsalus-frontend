import { showModal } from '@openmrs/esm-framework';
import { launchWorkspace2 } from '@openmrs/esm-styleguide';
import { act, renderHook } from '@testing-library/react';

import { useLaunchWorkspaceRequiringVisit } from './workspaces';

const state = vi.hoisted(() => ({
  patientUuid: 'synthetic-a',
  openedPatientUuid: 'synthetic-a',
  visitsEnabled: false,
  visitContext: null as { uuid: string } | null,
}));

vi.mock('./store/patient-chart-store', () => {
  const chart = () => ({
    patientUuid: state.patientUuid,
    patient: { resourceType: 'Patient', id: state.patientUuid },
    visitContext: state.visitContext,
    mutateVisitContext: null,
  });
  return {
    usePatientChartStore: (uuid?: string) =>
      !uuid || uuid === state.patientUuid
        ? chart()
        : { patientUuid: null, patient: null, visitContext: null, mutateVisitContext: null },
    getPatientChartStore: () => ({ getState: chart }),
    getPatientUuidFromStore: () => state.patientUuid,
  };
});
vi.mock('./offline/visit', () => ({ useVisitOrOfflineVisit: () => ({ currentVisit: null }) }));
vi.mock('./useSystemVisitSetting', () => ({
  useSystemVisitSetting: () => ({ systemVisitEnabled: state.visitsEnabled }),
}));
vi.mock('@openmrs/esm-framework', async (original) => ({
  ...(await original<typeof import('@openmrs/esm-framework')>()),
  useFeatureFlag: () => false,
  showModal: vi.fn(() => vi.fn()),
}));
vi.mock('@openmrs/esm-extensions', async (original) => ({
  ...(await original<typeof import('@openmrs/esm-extensions')>()),
  getWindowByWorkspaceName: () => ({ name: 'synthetic-window' }),
  getGroupByWindowName: () => ({ name: 'patient-chart' }),
  workspace2Store: {
    getState: () => ({
      openedGroup: {
        groupName: 'patient-chart',
        props: {
          patientUuid: state.openedPatientUuid,
          patient: { resourceType: 'Patient', id: state.openedPatientUuid },
          visitContext: null,
          mutateVisitContext: null,
        },
      },
    }),
  },
}));
vi.mock('@openmrs/esm-styleguide', async (original) => ({
  ...(await original<typeof import('@openmrs/esm-styleguide')>()),
  launchWorkspace2: vi.fn().mockResolvedValue(true),
}));

beforeEach(() => {
  state.patientUuid = 'synthetic-a';
  state.openedPatientUuid = 'synthetic-a';
  state.visitsEnabled = false;
  state.visitContext = null;
});

it('does not inherit a workspace group belonging to another patient', async () => {
  const { result } = renderHook(() => useLaunchWorkspaceRequiringVisit('synthetic-b', 'synthetic-form'));
  await act(async () => result.current());
  expect(launchWorkspace2).toHaveBeenCalledWith('synthetic-form', null, null, {
    patient: null,
    patientUuid: 'synthetic-b',
    visitContext: null,
    mutateVisitContext: null,
  });
});

it('rejects conflicting workspace and group patient identities', async () => {
  const { result } = renderHook(() => useLaunchWorkspaceRequiringVisit('synthetic-b', 'synthetic-form'));
  await act(async () => result.current({}, undefined, { patientUuid: 'synthetic-a' }));
  await act(async () => result.current({ patientUuid: 'synthetic-a' }));
  expect(launchWorkspace2).not.toHaveBeenCalled();
});

it('discards an opening pending a visit after the requested patient changes', async () => {
  state.visitsEnabled = true;
  const { result, rerender } = renderHook(({ uuid }) => useLaunchWorkspaceRequiringVisit(uuid, 'synthetic-form'), {
    initialProps: { uuid: 'synthetic-a' },
  });
  act(() => result.current());
  const props = vi.mocked(showModal).mock.calls[0][1] as { onVisitStarted: () => void };
  state.patientUuid = 'synthetic-b';
  state.openedPatientUuid = 'synthetic-b';
  rerender({ uuid: 'synthetic-b' });
  await act(async () => props.onVisitStarted());
  expect(launchWorkspace2).not.toHaveBeenCalled();
});

it('uses the refreshed visit group after the visit prompt completes', async () => {
  state.visitsEnabled = true;
  const { result } = renderHook(() => useLaunchWorkspaceRequiringVisit('synthetic-a', 'synthetic-form'));
  act(() => result.current());
  const props = vi.mocked(showModal).mock.calls[0][1] as { onVisitStarted: () => void };
  state.visitContext = { uuid: 'synthetic-current-visit' };
  state.openedPatientUuid = '';
  await act(async () => props.onVisitStarted());
  expect(launchWorkspace2).toHaveBeenCalledWith(
    'synthetic-form',
    null,
    null,
    expect.objectContaining({ patientUuid: 'synthetic-a', visitContext: state.visitContext }),
  );
});

it('does not open a form after its owner unmounts', async () => {
  state.visitsEnabled = true;
  const { result, unmount } = renderHook(() => useLaunchWorkspaceRequiringVisit('synthetic-a', 'synthetic-form'));
  act(() => result.current());
  const props = vi.mocked(showModal).mock.calls[0][1] as { onVisitStarted: () => void };
  unmount();
  await act(async () => props.onVisitStarted());
  expect(launchWorkspace2).not.toHaveBeenCalled();
});
