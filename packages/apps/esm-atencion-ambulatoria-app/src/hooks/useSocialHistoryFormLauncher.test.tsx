import { launchWorkspace2, openmrsFetch, showSnackbar, useConfig, userHasAccess } from '@openmrs/esm-framework';
import { workspace2Store } from '@openmrs/esm-framework/src/internal';
import { usePatientChartStore } from '@openmrs/esm-patient-common-lib';
import { act, renderHook } from '@testing-library/react';
import { useAmbulatoryVisitGuard } from './useAmbulatoryVisitGuard';
import { useSocialHistoryFormLauncher } from './useSocialHistoryFormLauncher';

vi.mock('@openmrs/esm-framework/src/internal', () => ({ workspace2Store: { getState: vi.fn() } }));
vi.mock('@openmrs/esm-patient-common-lib', async () => ({
  ...(await vi.importActual('@openmrs/esm-patient-common-lib')),
  usePatientChartStore: vi.fn(),
}));
vi.mock('./useAmbulatoryVisitGuard', () => ({ useAmbulatoryVisitGuard: vi.fn() }));

const patientUuid = 'synthetic-patient';
const formUuid = '11111111-1111-4111-8111-111111111111';
const encounterTypeUuid = '22222222-2222-4222-8222-222222222222';
const form = { uuid: formUuid, published: true, retired: false, encounterType: { uuid: encounterTypeUuid } };
const visit = { uuid: 'synthetic-visit', startDatetime: '2026-09-21T10:00:00Z', visitType: { uuid: 'ambulatory' } };
const encounter = {
  uuid: 'synthetic-encounter',
  patient: { uuid: patientUuid },
  form: { uuid: formUuid },
  encounterType: { uuid: encounterTypeUuid },
  visit,
  voided: false,
};
const requireVisit = vi.fn();

function mount() {
  return renderHook(() => useSocialHistoryFormLauncher(patientUuid));
}
async function launch(result: ReturnType<typeof mount>['result'], uuid?: string) {
  let opened: boolean;
  await act(async () => {
    opened = await result.current(uuid);
  });
  return opened;
}

describe('social-history form launcher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useConfig).mockReturnValue({
      socialHistory: { formUuid, encounterTypeUuid },
      visitTypes: { ambulatory: 'ambulatory' },
    });
    vi.mocked(userHasAccess).mockReturnValue(true);
    vi.mocked(usePatientChartStore).mockReturnValue({ patient: { id: patientUuid } } as never);
    requireVisit.mockReturnValue(visit);
    vi.mocked(useAmbulatoryVisitGuard).mockReturnValue({
      requireAmbulatoryVisit: requireVisit,
      verifiedAmbulatoryVisitUuid: visit.uuid,
    });
    vi.mocked(workspace2Store.getState).mockReturnValue({ openedWindows: [] } as never);
    vi.mocked(launchWorkspace2).mockResolvedValue(true);
    vi.mocked(openmrsFetch).mockImplementation(
      async (url) =>
        ({
          data: String(url).includes('/form/')
            ? form
            : String(url).includes('/encounter/synthetic-encounter?')
              ? encounter
              : { results: [], totalCount: 0 },
        }) as never,
    );
  });

  it('binds creation to the verified patient, form and active visit using Workspace2', async () => {
    const mutate = vi.fn();
    const { result } = renderHook(() => useSocialHistoryFormLauncher(patientUuid, mutate));
    expect(await launch(result)).toBe(true);
    expect(launchWorkspace2).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        formInfo: expect.objectContaining({
          formUuid,
          patientUuid,
          encounterUuid: undefined,
          visitUuid: visit.uuid,
          visitStartDatetime: visit.startDatetime,
          visitTypeUuid: 'ambulatory',
        }),
      }),
      null,
      expect.objectContaining({ patientUuid, visitContext: visit }),
    );
    const args = vi.mocked(launchWorkspace2).mock.calls[0][1] as { mutateForm: () => void };
    args.mutateForm();
    expect(mutate).toHaveBeenCalledOnce();
  });

  it('opens the existing record in the active visit instead of creating a duplicate', async () => {
    vi.mocked(openmrsFetch)
      .mockResolvedValueOnce({ data: form } as never)
      .mockResolvedValueOnce({ data: { results: [encounter], totalCount: 1 } } as never);
    expect(await launch(mount().result)).toBe(true);
    expect(launchWorkspace2).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ formInfo: expect.objectContaining({ encounterUuid: encounter.uuid }) }),
      null,
      expect.anything(),
    );
  });

  it('edits with the original closed visit instead of the current visit', async () => {
    const oldVisit = { ...visit, uuid: 'synthetic-old-visit', stopDatetime: '2026-09-20T12:00:00Z' };
    vi.mocked(openmrsFetch).mockResolvedValueOnce({ data: { ...encounter, visit: oldVisit } } as never);
    expect(await launch(mount().result, encounter.uuid)).toBe(true);
    expect(requireVisit).not.toHaveBeenCalled();
    expect(launchWorkspace2).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        formInfo: expect.objectContaining({
          encounterUuid: encounter.uuid,
          visitUuid: oldVisit.uuid,
          visitStopDatetime: oldVisit.stopDatetime,
        }),
      }),
      null,
      expect.objectContaining({ visitContext: oldVisit }),
    );
  });

  it.each([
    ['unpublished', { ...form, published: false }],
    ['retired', { ...form, retired: true }],
    ['wrong type', { ...form, encounterType: { uuid: 'wrong' } }],
    ['wrong form', { ...form, uuid: 'wrong' }],
  ])('rejects %s form metadata', async (_label, data) => {
    vi.mocked(openmrsFetch).mockResolvedValueOnce({ data } as never);
    expect(await launch(mount().result)).toBe(false);
    expect(launchWorkspace2).not.toHaveBeenCalled();
  });

  it.each([
    { patient: { uuid: 'another-patient' } },
    { form: { uuid: 'legacy-form' } },
    { encounterType: { uuid: 'physical-therapy' } },
    { visit: null },
    { voided: true },
    { uuid: 'another-encounter' },
  ])('rejects editing an unverified encounter: %j', async (override) => {
    vi.mocked(openmrsFetch).mockResolvedValueOnce({ data: { ...encounter, ...override } } as never);
    expect(await launch(mount().result, encounter.uuid)).toBe(false);
    expect(launchWorkspace2).not.toHaveBeenCalled();
  });

  it('does not open without edit permission', async () => {
    vi.mocked(userHasAccess).mockReturnValue(false);
    expect(await launch(mount().result)).toBe(false);
    expect(openmrsFetch).not.toHaveBeenCalled();
  });

  it('requires a verified active visit for creation', async () => {
    requireVisit.mockReturnValue(null);
    expect(await launch(mount().result)).toBe(false);
    expect(openmrsFetch).not.toHaveBeenCalled();
  });

  it('fails closed on duplicates', async () => {
    vi.mocked(openmrsFetch)
      .mockResolvedValueOnce({ data: form } as never)
      .mockResolvedValueOnce({
        data: { results: [encounter, { ...encounter, uuid: 'duplicate' }], totalCount: 2 },
      } as never);
    expect(await launch(mount().result)).toBe(false);
    expect(launchWorkspace2).not.toHaveBeenCalled();
  });

  it('propagates a declined workspace launch so the caller stays open', async () => {
    vi.mocked(launchWorkspace2).mockResolvedValue(false);
    expect(await launch(mount().result)).toBe(false);
  });

  it.each([403, 404, 500])('allows retry after HTTP %s without displaying server details', async (status) => {
    vi.mocked(openmrsFetch).mockRejectedValueOnce({ status, message: 'private-server-detail' });
    const { result } = mount();
    expect(await launch(result)).toBe(false);
    expect(JSON.stringify(vi.mocked(showSnackbar).mock.calls)).not.toContain('private-server-detail');
    expect(await launch(result)).toBe(true);
  });

  it.each([
    'patient-change',
    'unmount',
  ])('cancels pending resolution on %s and suppresses repeated clicks', async (scenario) => {
    let resolve: (value: unknown) => void;
    vi.mocked(openmrsFetch).mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      }) as never,
    );
    const { result, rerender, unmount } = renderHook(({ patient }) => useSocialHistoryFormLauncher(patient), {
      initialProps: { patient: patientUuid },
    });
    let pending: Promise<boolean>;
    act(() => {
      pending = result.current();
    });
    expect(await launch(result)).toBe(false);
    if (scenario === 'unmount') unmount();
    else rerender({ patient: 'another-patient' });
    await act(async () => {
      resolve({ data: form });
      expect(await pending).toBe(false);
    });
    expect(launchWorkspace2).not.toHaveBeenCalled();
  });
  it.each(['visit-change', 'permission-revoked'])('cancels metadata resolution after %s', async (scenario) => {
    let resolve: (value: unknown) => void;
    vi.mocked(openmrsFetch).mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      }) as never,
    );
    const { result, rerender } = mount();
    let pending: Promise<boolean>;
    act(() => {
      pending = result.current();
    });
    if (scenario === 'permission-revoked') vi.mocked(userHasAccess).mockReturnValue(false);
    else
      vi.mocked(useAmbulatoryVisitGuard).mockReturnValue({
        requireAmbulatoryVisit: requireVisit,
        verifiedAmbulatoryVisitUuid: 'another-visit',
      });
    rerender();
    await act(async () => {
      resolve({ data: form });
      expect(await pending).toBe(false);
    });
    expect(launchWorkspace2).not.toHaveBeenCalled();
  });

  it('restores the same workspace props while a form with unsaved changes is still open', async () => {
    const { result } = mount();
    expect(await launch(result)).toBe(true);
    const previous = vi.mocked(launchWorkspace2).mock.calls[0];
    vi.mocked(workspace2Store.getState).mockReturnValue({
      openedWindows: [{ openedWorkspaces: [{ workspaceName: previous[0], props: previous[1] }] }],
    } as never);
    expect(await launch(result)).toBe(true);
    expect(vi.mocked(launchWorkspace2).mock.calls[1][1]).toBe(previous[1]);
  });
});
