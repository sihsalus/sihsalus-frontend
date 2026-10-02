import { launchWorkspace2, showSnackbar } from '@openmrs/esm-framework';
import { getPatientChartStore } from '@openmrs/esm-patient-common-lib';
import { act, render } from '@testing-library/react';
import type { ComponentProps } from 'react';
import AddDrugOrder from './add-drug-order.component';
import AddDrugOrderWorkspace from './add-drug-order.workspace';

vi.mock('./add-drug-order.component', () => ({ default: vi.fn(() => null) }));
vi.mock('@openmrs/esm-patient-common-lib', async () => ({
  ...(await vi.importActual('@openmrs/esm-patient-common-lib')),
  getPatientChartStore: vi.fn(),
}));

type Props = ComponentProps<typeof AddDrugOrderWorkspace>;
let props: Props;
let context: { patientUuid: string; visitContext: { uuid: string } };
const form = () => vi.mocked(AddDrugOrder).mock.calls.at(-1)[0];

beforeEach(() => {
  vi.clearAllMocks();
  context = { patientUuid: 'synthetic-patient', visitContext: { uuid: 'synthetic-visit' } };
  vi.mocked(getPatientChartStore).mockReturnValue({ getState: () => context } as ReturnType<
    typeof getPatientChartStore
  >);
  vi.mocked(launchWorkspace2).mockResolvedValue(true);
  props = {
    groupProps: { ...context, patient: { id: context.patientUuid }, mutateVisitContext: vi.fn() },
    workspaceProps: { returnToOrderBasket: true },
    windowProps: { encounterUuid: 'synthetic-encounter' },
    isRootWorkspace: true,
    closeWorkspace: vi.fn().mockResolvedValue(true),
  } as unknown as Props;
});

test('direct entry keeps the canonical medication form and returns to review the existing basket after saving', async () => {
  render(<AddDrugOrderWorkspace {...props} />);
  expect(form()).toMatchObject({
    patientUuid: context.patientUuid,
    patient: props.groupProps.patient,
    visitContext: props.groupProps.visitContext,
    initialOrder: undefined,
    trackPatientChartContext: true,
  });
  await act(() => form().closeWorkspace({ discardUnsavedChanges: true }));
  expect(props.closeWorkspace).toHaveBeenCalledExactlyOnceWith({ discardUnsavedChanges: true });
  expect(launchWorkspace2).toHaveBeenCalledExactlyOnceWith('order-basket', null, props.windowProps, props.groupProps);
});

test('cancel returns to the basket only after the workspace confirms closing', async () => {
  render(<AddDrugOrderWorkspace {...props} />);
  await act(() => form().closeWorkspace());
  expect(props.closeWorkspace).toHaveBeenCalledExactlyOnceWith(undefined);
  expect(launchWorkspace2).toHaveBeenCalledOnce();
});

test('declining to discard changes leaves the current form in place', async () => {
  vi.mocked(props.closeWorkspace).mockResolvedValue(false);
  render(<AddDrugOrderWorkspace {...props} />);
  await act(() => form().closeWorkspace());
  expect(launchWorkspace2).not.toHaveBeenCalled();
});

test.each([
  'patient',
  'visit',
])('a %s change during closing cannot reopen the previous clinical context', async (changed) => {
  vi.mocked(props.closeWorkspace).mockImplementation(async () => {
    context =
      changed === 'patient'
        ? { ...context, patientUuid: 'another-patient' }
        : { ...context, visitContext: { uuid: 'another-visit' } };
    return true;
  });
  render(<AddDrugOrderWorkspace {...props} />);
  await act(() => form().closeWorkspace());
  expect(launchWorkspace2).not.toHaveBeenCalled();
});

test.each([
  { isRootWorkspace: false, workspaceProps: { returnToOrderBasket: true } },
  { isRootWorkspace: true, workspaceProps: {} },
])('ordinary entries and existing child navigation retain their close behavior: %j', async (overrides) => {
  render(<AddDrugOrderWorkspace {...props} {...overrides} />);
  await act(() => form().closeWorkspace({ discardUnsavedChanges: true }));
  expect(props.closeWorkspace).toHaveBeenCalledOnce();
  expect(launchWorkspace2).not.toHaveBeenCalled();
});

test.each([
  false,
  new Error('SYNTHETIC-PRIVATE-ENDPOINT'),
])('a refused or failed basket launch leaves a safe recovery message', async (outcome) => {
  if (outcome instanceof Error) vi.mocked(launchWorkspace2).mockRejectedValueOnce(outcome);
  else vi.mocked(launchWorkspace2).mockResolvedValueOnce(outcome);
  render(<AddDrugOrderWorkspace {...props} />);
  await act(() => form().closeWorkspace({ discardUnsavedChanges: true }));
  expect(showSnackbar).toHaveBeenCalledWith(
    expect.objectContaining({ kind: 'error', subtitle: expect.stringContaining('pending orders remain') }),
  );
  expect(JSON.stringify(vi.mocked(showSnackbar).mock.calls)).not.toContain('SYNTHETIC-PRIVATE');
});
