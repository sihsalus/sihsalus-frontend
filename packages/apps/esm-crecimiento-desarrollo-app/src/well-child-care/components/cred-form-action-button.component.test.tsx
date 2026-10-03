import { ActionMenuButton2 } from '@openmrs/esm-framework';
import { usePatientChartStore, useStartVisitIfNeeded } from '@openmrs/esm-patient-common-lib';
import { render, screen } from '@testing-library/react';
import { credCourseLifeEditPrivilege } from '../../constants';
import routes from '../../routes.json';
import CREDFormActionButton from './cred-form-action-button.component';

vi.mock('@openmrs/esm-patient-common-lib', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@openmrs/esm-patient-common-lib')>()),
  usePatientChartStore: vi.fn(),
  useStartVisitIfNeeded: vi.fn(),
  useLaunchWorkspaceRequiringVisit: vi.fn(() => vi.fn()),
}));
vi.mock('../../hooks/useCREDSchedule', () => ({ useCREDSchedule: () => ({ nextDueControl: undefined }) }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (_key: string, fallback: string) => fallback }) }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(ActionMenuButton2).mockImplementation(({ label }) => <button type="button">{label}</button>);
  vi.mocked(usePatientChartStore).mockReturnValue({ patientUuid: 'synthetic-child' } as never);
  vi.mocked(useStartVisitIfNeeded).mockReturnValue(vi.fn().mockResolvedValue(true));
});

it('registers the existing action on the current patient chart window with the same edit privilege', () => {
  expect(routes.workspaceWindows2.find(({ name }) => name === 'patient-chart-well-child-care-forms')).toEqual(
    expect.objectContaining({ icon: 'credFormActionButton', privileges: credCourseLifeEditPrivilege }),
  );
});

it('uses the workspace group patient rather than a previous patient in the store', () => {
  const groupProps = {
    patientUuid: 'synthetic-group-child',
    patient: null,
    visitContext: null,
    mutateVisitContext: null,
  };
  render(<CREDFormActionButton groupProps={groupProps} />);
  expect(screen.getByRole('button', { name: 'Formularios Crecimiento y Desarrollo' })).toBeVisible();
  expect(useStartVisitIfNeeded).toHaveBeenCalledWith('synthetic-group-child');
  expect(ActionMenuButton2).toHaveBeenCalledWith(
    expect.objectContaining({
      workspaceToLaunch: expect.objectContaining({
        workspaceName: 'wellchild-control-form',
        workspaceProps: { patientUuid: 'synthetic-group-child' },
        groupProps,
      }),
    }),
    expect.anything(),
  );
});

it('preserves the asynchronous visit requirement before launching forms', async () => {
  const startVisitIfNeeded = vi.fn().mockResolvedValue(false);
  vi.mocked(useStartVisitIfNeeded).mockReturnValue(startVisitIfNeeded);
  render(<CREDFormActionButton groupProps={null} />);
  const props = vi.mocked(ActionMenuButton2).mock.calls.at(-1)?.[0];
  expect(props?.onBeforeWorkspaceLaunch).toBe(startVisitIfNeeded);
  await expect(props?.onBeforeWorkspaceLaunch?.()).resolves.toBe(false);
});

it('does not offer an action without a patient identity', () => {
  vi.mocked(usePatientChartStore).mockReturnValue({ patientUuid: null } as never);
  render(<CREDFormActionButton groupProps={null} />);
  expect(screen.queryByRole('button', { name: 'Formularios Crecimiento y Desarrollo' })).not.toBeInTheDocument();
});
