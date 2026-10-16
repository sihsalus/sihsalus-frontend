import { openmrsFetch, useConfig, usePatient } from '@openmrs/esm-framework';
import { useLaunchWorkspaceRequiringVisit } from '@openmrs/esm-patient-common-lib';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import { SWRConfig } from 'swr';
import { formEntryWorkspace } from '../types';
import { useMaternalFormLauncher } from './useMaternalFormLauncher';

const launch = vi.hoisted(() => vi.fn());
vi.mock('@openmrs/esm-patient-common-lib', async (original) => ({
  ...(await original<typeof import('@openmrs/esm-patient-common-lib')>()),
  useLaunchWorkspaceRequiringVisit: vi.fn(() => launch),
}));
const wrapper = ({ children }: PropsWithChildren) => (
  <SWRConfig value={{ provider: () => new Map(), shouldRetryOnError: false, dedupingInterval: 0 }}>
    {children}
  </SWRConfig>
);
const published = { uuid: 'synthetic-published-form', name: 'OBST-001-ANTECEDENTES', published: true, retired: false };
beforeEach(() => {
  vi.mocked(useConfig).mockReturnValue({ formsList: { maternalHistory: published.name } });
  vi.mocked(usePatient).mockReturnValue({ patientUuid: 'synthetic-other-chart' } as ReturnType<typeof usePatient>);
  vi.mocked(openmrsFetch).mockResolvedValue({ data: { results: [published] } } as Awaited<
    ReturnType<typeof openmrsFetch>
  >);
});
it('resolves the published UUID then delegates visit and identity to the existing patient workspace launcher', async () => {
  const refresh = vi.fn();
  const { result } = renderHook(
    () => useMaternalFormLauncher('maternalHistory', 'Obstetric history', 'synthetic-mother'),
    { wrapper },
  );
  await waitFor(() => expect(result.current.form?.uuid).toBe(published.uuid));
  act(() => result.current.launchForm('', refresh));
  expect(useLaunchWorkspaceRequiringVisit).toHaveBeenCalledWith('synthetic-mother', formEntryWorkspace);
  expect(launch).toHaveBeenCalledWith(
    expect.objectContaining({
      patientUuid: 'synthetic-mother',
      form: expect.objectContaining({ uuid: published.uuid }),
      encounterUuid: '',
      handlePostResponse: refresh,
    }),
  );
});
it('does not open a form before its publication and exact identifier have been confirmed', async () => {
  let finish!: (value: Awaited<ReturnType<typeof openmrsFetch>>) => void;
  vi.mocked(openmrsFetch).mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const { result } = renderHook(
    () => useMaternalFormLauncher('maternalHistory', 'Obstetric history', 'synthetic-mother'),
    { wrapper },
  );
  act(() => result.current.launchForm());
  expect(launch).not.toHaveBeenCalled();
  await act(async () => finish({ data: { results: [published] } } as Awaited<ReturnType<typeof openmrsFetch>>));
  await waitFor(() => expect(result.current.form).toBeDefined());
});
