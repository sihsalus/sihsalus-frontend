import { launchWorkspace2, showSnackbar } from '@openmrs/esm-framework';
import { fetchOpenMRSForm } from '@sihsalus/esm-form-engine-lib';
import { act, renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { SWRConfig } from 'swr';

import { resolveOutpatientForm, useOutpatientFormLauncher } from './useOutpatientFormLauncher';

vi.mock('@sihsalus/esm-form-engine-lib', () => ({
  fetchOpenMRSForm: vi.fn(),
}));

const verifiedForm = {
  uuid: '11111111-1111-4111-8111-111111111111',
  name: 'CE-SOAP-001-NOTA SOAP',
  encounterType: { uuid: 'encounter-type-uuid', display: 'Consulta externa' },
  version: '1.0',
  description: 'Nota SOAP',
  published: true,
  retired: false,
  resources: [],
};

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <SWRConfig
    value={{
      dedupingInterval: 0,
      provider: () => new Map(),
      revalidateOnFocus: false,
      shouldRetryOnError: false,
    }}
  >
    {children}
  </SWRConfig>
);

const mockFetchOpenMRSForm = vi.mocked(fetchOpenMRSForm);
const mockLaunchWorkspace2 = vi.mocked(launchWorkspace2);
const mockShowSnackbar = vi.mocked(showSnackbar);

describe('outpatient form launcher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchOpenMRSForm.mockResolvedValue(verifiedForm);
  });

  it('maps the centrally verified form to the Workspace 2 form contract', async () => {
    await expect(resolveOutpatientForm('CE-SOAP-001-NOTA SOAP', 'Examen físico / SOAP')).resolves.toEqual({
      ...verifiedForm,
      display: verifiedForm.name,
    });
    expect(mockFetchOpenMRSForm).toHaveBeenCalledWith('CE-SOAP-001-NOTA SOAP');
  });

  it('fails when the central resolver cannot prove a form identity', async () => {
    mockFetchOpenMRSForm.mockResolvedValue(null);

    await expect(resolveOutpatientForm('', 'Examen físico / SOAP')).rejects.toThrow(/identifier is empty/i);
  });

  it('launches the v2 workspace once and refreshes history only after a successful form response', async () => {
    const onSaved = vi.fn();
    const { result } = renderHook(
      () =>
        useOutpatientFormLauncher({
          fallbackDisplay: 'Examen físico / SOAP',
          identifier: 'CE-SOAP-001-NOTA SOAP',
          onSaved,
          patientUuid: 'patient-uuid',
        }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.form).toBeDefined());

    let firstLaunch = Promise.resolve(false);
    let secondLaunch = Promise.resolve(false);
    act(() => {
      firstLaunch = result.current.launchForm();
      secondLaunch = result.current.launchForm();
    });

    expect(firstLaunch).toBe(secondLaunch);
    await act(async () => {
      await expect(firstLaunch).resolves.toBe(true);
    });

    expect(mockLaunchWorkspace2).toHaveBeenCalledTimes(1);
    expect(mockLaunchWorkspace2).toHaveBeenCalledWith('patient-form-entry-workspace-v2', {
      form: { ...verifiedForm, display: verifiedForm.name },
      encounterUuid: '',
      formInfo: { patientUuid: 'patient-uuid' },
      handlePostResponse: expect.any(Function),
      workspaceTitle: 'Examen físico / SOAP',
    });
    expect(onSaved).not.toHaveBeenCalled();

    const workspaceProps = mockLaunchWorkspace2.mock.calls[0][1] as { handlePostResponse: () => Promise<void> };
    await act(async () => {
      await workspaceProps.handlePostResponse();
    });
    expect(onSaved).toHaveBeenCalledTimes(1);
  });

  it('blocks launch while form verification is pending', async () => {
    mockFetchOpenMRSForm.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(
      () =>
        useOutpatientFormLauncher({
          fallbackDisplay: 'Anamnesis',
          identifier: 'CE-ANAM-001-ANAMNESIS',
          patientUuid: 'patient-uuid',
        }),
      { wrapper },
    );

    await act(async () => {
      await expect(result.current.launchForm()).resolves.toBe(false);
    });

    expect(mockLaunchWorkspace2).not.toHaveBeenCalled();
    expect(mockShowSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'info', title: 'Validating outpatient form' }),
    );
  });

  it('blocks a missing or failed configured form without exposing technical details', async () => {
    mockFetchOpenMRSForm.mockRejectedValue(new Error('SQLSTATE form_definition private-content'));
    const { result } = renderHook(
      () =>
        useOutpatientFormLauncher({
          fallbackDisplay: 'Diagnóstico',
          identifier: 'CE-001-CONSULTA EXTERNA',
          patientUuid: 'patient-uuid',
        }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.error).toBeDefined());
    await act(async () => {
      await expect(result.current.launchForm()).resolves.toBe(false);
    });

    expect(mockLaunchWorkspace2).not.toHaveBeenCalled();
    expect(mockShowSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'error',
        subtitle: 'Verify that the configured UUID or exact name identifies one published, non-retired form.',
      }),
    );
    expect(mockShowSnackbar.mock.calls.flatMap(([message]) => message.subtitle ?? []).join(' ')).not.toMatch(
      /SQLSTATE|private-content/i,
    );
  });

  it('does not request or launch a form when the section is not configured', async () => {
    const { result } = renderHook(
      () =>
        useOutpatientFormLauncher({
          fallbackDisplay: 'Referencia',
          identifier: ' ',
          patientUuid: 'patient-uuid',
        }),
      { wrapper },
    );

    await act(async () => {
      await expect(result.current.launchForm()).resolves.toBe(false);
    });

    expect(mockFetchOpenMRSForm).not.toHaveBeenCalled();
    expect(mockLaunchWorkspace2).not.toHaveBeenCalled();
    expect(mockShowSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'warning', title: 'Outpatient form not configured' }),
    );
  });

  it('reports a refresh failure as post-save and never invites a duplicate clinical submission', async () => {
    const onSaved = vi.fn().mockRejectedValue(new Error('patient_uuid=private SQLSTATE 23505'));
    const { result } = renderHook(
      () =>
        useOutpatientFormLauncher({
          fallbackDisplay: 'Plan de tratamiento',
          identifier: 'CE-001-CONSULTA EXTERNA',
          onSaved,
          patientUuid: 'patient-uuid',
        }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.form).toBeDefined());
    await act(async () => {
      await result.current.launchForm();
    });
    const workspaceProps = mockLaunchWorkspace2.mock.calls[0][1] as { handlePostResponse: () => Promise<void> };
    await act(async () => {
      await workspaceProps.handlePostResponse();
    });

    expect(mockShowSnackbar).toHaveBeenCalledWith({
      kind: 'warning',
      title: 'Form saved; history refresh incomplete',
      subtitle: 'The clinical form was saved. Do not submit it again; refresh and review the patient history.',
    });
    expect(mockShowSnackbar.mock.calls.flatMap(([message]) => message.subtitle ?? []).join(' ')).not.toMatch(
      /patient_uuid|SQLSTATE/i,
    );
  });
});
