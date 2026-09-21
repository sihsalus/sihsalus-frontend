import { openmrsFetch, showSnackbar, useConfig } from '@openmrs/esm-framework';
import { launchPatientWorkspace } from '@openmrs/esm-patient-common-lib';
import { act, renderHook } from '@testing-library/react';
import { useSocialHistoryFormLauncher } from './useSocialHistoryFormLauncher';

vi.mock('@openmrs/esm-patient-common-lib', async () => ({
  ...(await vi.importActual('@openmrs/esm-patient-common-lib')),
  launchPatientWorkspace: vi.fn(),
}));

const formUuid = '11111111-1111-4111-8111-111111111111';
const encounterTypeUuid = '22222222-2222-4222-8222-222222222222';
const form = { uuid: formUuid, published: true, retired: false, encounterType: { uuid: encounterTypeUuid } };

describe('social-history form content verification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useConfig).mockReturnValue({
      clinicalEncounterUuid: encounterTypeUuid,
      formsList: { clinicalEncounterFormUuid: formUuid },
    });
    vi.mocked(openmrsFetch).mockResolvedValue({ data: form } as never);
  });

  it('opens the existing published form only after verifying its encounter type', async () => {
    const mutate = vi.fn();
    const { result } = renderHook(() => useSocialHistoryFormLauncher('synthetic-patient', mutate));
    let opened: boolean;
    await act(async () => {
      opened = await result.current();
    });
    expect(opened).toBe(true);
    expect(openmrsFetch).toHaveBeenCalledExactlyOnceWith(expect.stringContaining('/form/' + formUuid + '?'));
    expect(launchPatientWorkspace).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        mutateForm: mutate,
        formInfo: expect.objectContaining({ formUuid, patientUuid: 'synthetic-patient', encounterUuid: '' }),
      }),
    );
    expect(mutate).not.toHaveBeenCalled();
  });

  it.each([
    ['unpublished', { ...form, published: false }],
    ['retired', { ...form, retired: true }],
    ['different encounter type', { ...form, encounterType: { uuid: 'other-type' } }],
    ['different form', { ...form, uuid: 'other-form' }],
    ['missing publication state', { uuid: formUuid, encounterType: form.encounterType }],
  ])('does not open %s metadata', async (_case, metadata) => {
    vi.mocked(openmrsFetch).mockResolvedValue({ data: metadata } as never);
    const { result } = renderHook(() => useSocialHistoryFormLauncher('synthetic-patient'));
    await act(async () => {
      expect(await result.current()).toBe(false);
    });
    expect(launchPatientWorkspace).not.toHaveBeenCalled();
    expect(showSnackbar).toHaveBeenCalledWith(expect.objectContaining({ kind: 'error' }));
  });

  it.each([
    403, 404, 500,
  ])('keeps metadata HTTP %s failures recoverable without exposing server details', async (status) => {
    vi.mocked(openmrsFetch).mockRejectedValueOnce({ status, message: 'private-server-detail' });
    const { result } = renderHook(() => useSocialHistoryFormLauncher('synthetic-patient'));
    await act(async () => {
      expect(await result.current()).toBe(false);
    });
    expect(launchPatientWorkspace).not.toHaveBeenCalled();
    expect(JSON.stringify(vi.mocked(showSnackbar).mock.calls)).not.toContain('private-server-detail');
    await act(async () => {
      expect(await result.current()).toBe(true);
    });
    expect(launchPatientWorkspace).toHaveBeenCalledTimes(1);
  });

  it('does not query or open a form with missing configuration', async () => {
    vi.mocked(useConfig).mockReturnValue({ formsList: {} });
    const { result } = renderHook(() => useSocialHistoryFormLauncher('synthetic-patient'));
    await act(async () => {
      expect(await result.current()).toBe(false);
    });
    expect(openmrsFetch).not.toHaveBeenCalled();
    expect(launchPatientWorkspace).not.toHaveBeenCalled();
  });

  it('suppresses overlapping clicks and discards a response after changing patients', async () => {
    let resolveRequest: (value: unknown) => void;
    vi.mocked(openmrsFetch).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveRequest = resolve;
        }) as never,
    );
    const { result, rerender } = renderHook(({ patient }) => useSocialHistoryFormLauncher(patient), {
      initialProps: { patient: 'synthetic-patient-a' },
    });
    let firstRequest: Promise<boolean>;
    act(() => {
      firstRequest = result.current();
    });
    await act(async () => {
      expect(await result.current()).toBe(false);
    });
    expect(openmrsFetch).toHaveBeenCalledTimes(1);
    rerender({ patient: 'synthetic-patient-b' });
    await act(async () => {
      resolveRequest({ data: form });
      expect(await firstRequest).toBe(false);
    });
    expect(launchPatientWorkspace).not.toHaveBeenCalled();
    await act(async () => {
      expect(await result.current()).toBe(true);
    });
    expect(launchPatientWorkspace).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        formInfo: expect.objectContaining({ patientUuid: 'synthetic-patient-b' }),
      }),
    );
  });

  it('does not open a workspace after its source unmounts', async () => {
    let resolveRequest: (value: unknown) => void;
    vi.mocked(openmrsFetch).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveRequest = resolve;
        }) as never,
    );
    const { result, unmount } = renderHook(() => useSocialHistoryFormLauncher('synthetic-patient'));
    let pending: Promise<boolean>;
    act(() => {
      pending = result.current();
    });
    unmount();
    await act(async () => {
      resolveRequest({ data: form });
      expect(await pending).toBe(false);
    });
    expect(launchPatientWorkspace).not.toHaveBeenCalled();
    expect(showSnackbar).not.toHaveBeenCalled();
  });
});
