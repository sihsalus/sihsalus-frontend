import { launchWorkspace2, openmrsFetch, usePatient } from '@openmrs/esm-framework';
import { useLaunchWorkspaceRequiringVisit } from '@openmrs/esm-patient-common-lib';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createInstance } from 'i18next';
import type { PropsWithChildren } from 'react';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import { SWRConfig } from 'swr';
import en from '../../../translations/en.json';
import { formEntryWorkspace } from '../../types';
import PatientObservationGroupTable from './patient-observation-group-table.component';

const mocks = vi.hoisted(() => ({ encounter: vi.fn(), launch: vi.fn(), refresh: vi.fn() }));
vi.mock('react-i18next', async () => {
  const { createRequire } = await import('node:module');
  return createRequire(import.meta.url)('react-i18next');
});
vi.mock('@openmrs/esm-framework', async (original) => ({
  ...(await original<typeof import('@openmrs/esm-framework')>()),
  isDesktop: () => true,
  useLayoutType: () => 'desktop',
}));
vi.mock('@openmrs/esm-patient-common-lib', async () => {
  const { createElement } = await import('react');
  return {
    CardHeader: ({ title, children }: PropsWithChildren<{ title: string }>) =>
      createElement('div', null, title, children),
    EmptyState: ({ launchForm }: { launchForm?: () => void }) =>
      launchForm ? createElement('button', { onClick: launchForm }, 'Add') : null,
    ErrorState: () => createElement('p', null, 'History unavailable'),
    useFilteredEncounter: mocks.encounter,
    useLaunchWorkspaceRequiringVisit: vi.fn(() => mocks.launch),
  };
});
vi.mock('@sihsalus/esm-rbac', () => ({ RequirePrivilege: ({ children }: PropsWithChildren) => children }));
vi.mock('./observation-group-details.component', () => ({ default: () => null }));

const published = {
  uuid: 'f1c3f50a-49b6-4d03-9b42-93e190523a08',
  name: 'OBST-002-EMBARAZO ACTUAL',
  published: true,
  retired: false,
};
const existing = {
  uuid: 'synthetic-original-encounter',
  encounterDatetime: '2026-10-01T10:00:00Z',
  form: { uuid: published.uuid, name: published.name },
  obs: [{ uuid: 'synthetic-group', display: 'Pregnancy: Recorded', groupMembers: [{ display: 'FUM: Recorded' }] }],
};
const i18n = createInstance();
function table(patientUuid = 'synthetic-mother') {
  return (
    <PatientObservationGroupTable
      patientUuid={patientUuid}
      headerTitle="Current pregnancy"
      displayText="Pregnancy records"
      encounterType="synthetic-prenatal-type"
      formUuid={published.name}
      formWorkspace={published.name}
      editPrivilege="synthetic-edit-privilege"
    />
  );
}
const wrapper = ({ children }: PropsWithChildren) => (
  <I18nextProvider i18n={i18n}>
    <SWRConfig value={{ provider: () => new Map(), shouldRetryOnError: false, dedupingInterval: 0 }}>
      {children}
    </SWRConfig>
  </I18nextProvider>
);
beforeEach(async () => {
  await i18n.use(initReactI18next).init({
    lng: 'en',
    defaultNS: '@sihsalus/esm-salud-materna-app',
    resources: { en: { '@sihsalus/esm-salud-materna-app': en } },
    interpolation: { escapeValue: false },
  });
  vi.mocked(usePatient).mockReturnValue({ patientUuid: 'synthetic-other-chart' } as ReturnType<typeof usePatient>);
  vi.mocked(openmrsFetch).mockImplementation(
    async (url) =>
      ({ data: String(url).includes(`/form/${published.uuid}?`) ? published : { results: [published] } }) as Awaited<
        ReturnType<typeof openmrsFetch>
      >,
  );
  mocks.encounter.mockReturnValue({
    prenatalEncounter: existing,
    isLoading: false,
    error: null,
    mutate: mocks.refresh,
  });
});

it('edits the displayed encounter with a resolved form and the explicit patient through the native visit launcher', async () => {
  render(table(), { wrapper });
  await waitFor(() => expect(screen.getByText('Edit').closest('button')).toBeEnabled());
  fireEvent.click(screen.getByText('Edit'));
  expect(launchWorkspace2).not.toHaveBeenCalled();
  await waitFor(() =>
    expect(mocks.launch).toHaveBeenCalledWith(
      expect.objectContaining({
        patientUuid: 'synthetic-mother',
        form: expect.objectContaining({ uuid: published.uuid }),
        encounterUuid: existing.uuid,
        handlePostResponse: expect.any(Function),
      }),
    ),
  );
  expect(useLaunchWorkspaceRequiringVisit).toHaveBeenCalledWith('synthetic-mother', formEntryWorkspace);
  expect(openmrsFetch).toHaveBeenCalledWith(expect.stringContaining(`/form/${published.uuid}?`));
  expect(launchWorkspace2).not.toHaveBeenCalled();
  mocks.launch.mock.calls[0][0].handlePostResponse();
  expect(mocks.refresh).toHaveBeenCalledExactlyOnceWith();
});

it('only creates from a confirmed empty history and still resolves the configured form name', async () => {
  mocks.encounter.mockReturnValue({ prenatalEncounter: null, isLoading: false, error: null, mutate: mocks.refresh });
  render(table(), { wrapper });
  await waitFor(() => expect(openmrsFetch).toHaveBeenCalled());
  fireEvent.click(screen.getByText('Add'));
  await waitFor(() => expect(mocks.launch).toHaveBeenCalledWith(expect.objectContaining({ encounterUuid: '' })));
  expect(mocks.launch.mock.calls[0][0].form.uuid).toBe(published.uuid);
});

it('does not launch creation or editing from a partial or failed history', async () => {
  mocks.encounter.mockReturnValue({ prenatalEncounter: existing, isLoading: true, error: null, mutate: mocks.refresh });
  const { rerender } = render(table(), { wrapper });
  await waitFor(() => expect(openmrsFetch).toHaveBeenCalled());
  fireEvent.click(screen.getByText('Edit'));
  expect(mocks.launch).not.toHaveBeenCalled();
  expect(launchWorkspace2).not.toHaveBeenCalled();
  mocks.encounter.mockReturnValue({
    prenatalEncounter: null,
    isLoading: false,
    error: new Error('Synthetic history failure'),
    mutate: mocks.refresh,
  });
  rerender(table());
  expect(screen.getByText('History unavailable')).toBeVisible();
  expect(screen.queryByText('Add')).not.toBeInTheDocument();
  expect(mocks.launch).not.toHaveBeenCalled();
});

it('uses the next patient and encounter after a context change', async () => {
  const { rerender } = render(table(), { wrapper });
  await waitFor(() => expect(openmrsFetch).toHaveBeenCalled());
  mocks.encounter.mockReturnValue({
    prenatalEncounter: { ...existing, uuid: 'synthetic-next-encounter' },
    isLoading: false,
    error: null,
    mutate: mocks.refresh,
  });
  rerender(table('synthetic-next-mother'));
  fireEvent.click(screen.getByText('Edit'));
  await waitFor(() =>
    expect(mocks.launch).toHaveBeenCalledWith(
      expect.objectContaining({ patientUuid: 'synthetic-next-mother', encounterUuid: 'synthetic-next-encounter' }),
    ),
  );
});

it('retains an existing encounter even when it contains no grouped observations', async () => {
  mocks.encounter.mockReturnValue({
    prenatalEncounter: { ...existing, obs: [] },
    isLoading: false,
    error: null,
    mutate: mocks.refresh,
  });
  render(table(), { wrapper });
  fireEvent.click(await screen.findByText('Add'));
  expect(mocks.launch).toHaveBeenCalledWith(
    expect.objectContaining({ encounterUuid: existing.uuid, patientUuid: 'synthetic-mother' }),
  );
});

it('does not replace an unavailable historical form with a new configured form', async () => {
  vi.mocked(openmrsFetch).mockResolvedValue({ data: { ...published, retired: true } } as Awaited<
    ReturnType<typeof openmrsFetch>
  >);
  render(table(), { wrapper });
  await waitFor(() => expect(screen.getByText('Edit').closest('button')).toBeEnabled());
  fireEvent.click(screen.getByText('Edit'));
  expect(mocks.launch).not.toHaveBeenCalled();
  expect(launchWorkspace2).not.toHaveBeenCalled();
  expect(openmrsFetch).toHaveBeenCalledExactlyOnceWith(expect.stringContaining(`/form/${published.uuid}?`));
});
