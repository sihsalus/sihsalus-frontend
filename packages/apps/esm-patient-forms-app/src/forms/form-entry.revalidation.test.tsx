import { openmrsFetch } from '@openmrs/esm-framework';
import { useMappedPatientObservations } from '@openmrs/esm-patient-common-lib';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import useSWR, { SWRConfig } from 'swr';
import { useOpenmrsFetchAll } from '../../../../libs/esm-react-utils/src/useOpenmrsFetchAll';
import FormEntry from './form-entry.component';

let saved = false;
vi.mock('@openmrs/esm-framework', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@openmrs/esm-framework')>()),
  openmrsFetch: vi.fn(),
  restBaseUrl: '/ws/rest/v1',
  fhirBaseUrl: '/ws/fhir2/R4',
  useConfig: () => ({ htmlFormEntryForms: [] }),
  useConnectivity: () => true,
  ExtensionSlot: ({ name, state }: { name: string; state?: { closeWorkspaceWithSavedChanges: () => void } }) =>
    name === 'form-widget-slot' ? (
      <button
        type="button"
        onClick={() => {
          saved = true;
          state?.closeWorkspaceWithSavedChanges();
        }}
      >
        Confirmed encounter save
      </button>
    ) : null,
}));

function EncounterReader({ view, patient = 'patient-a' }: { view: string; patient?: string }) {
  const { data, isLoading } = useOpenmrsFetchAll<{ uuid: string }>(
    `/ws/rest/v1/encounter?patient=${patient}&view=${view}`,
    { fetcher: openmrsFetch },
  );
  return (
    <output aria-label={`${view}-${patient}`}>
      {isLoading ? 'loading' : data?.map((record) => record.uuid).join(',')}
    </output>
  );
}
function VisitHistory({ patient = 'patient-a' }: { patient?: string }) {
  const { data, isLoading } = useOpenmrsFetchAll<{ uuid: string }>(
    `/ws/rest/v1/visit?patient=${patient}&includeInactive=true&limit=1`,
    { fetcher: openmrsFetch },
  );
  return (
    <output aria-label={`visits-${patient}`}>
      {isLoading ? 'loading' : data?.map((record) => record.uuid).join(',')}
    </output>
  );
}

function Observations() {
  const { data } = useMappedPatientObservations({
    patientUuid: 'patient-a',
    conceptUuids: ['weight'],
    getObservationKey: () => 'weight',
  });
  return <output aria-label="observations">{data?.[0]?.weight ?? 'loading'}</output>;
}
function Metadata() {
  const { data } = useSWR('/ws/rest/v1/concept/weight', openmrsFetch);
  return <output aria-label="metadata">{data ? 'ready' : 'loading'}</output>;
}

beforeEach(() => {
  saved = false;
  vi.clearAllMocks();
  vi.mocked(openmrsFetch).mockImplementation(async (input) => {
    const url = new URL(String(input), 'https://openmrs.test');
    if (url.pathname.endsWith('/encounter') || url.pathname.endsWith('/visit')) {
      const patient = url.searchParams.get('patient');
      const page = url.searchParams.get('startIndex') === '1' ? 2 : 1;
      const current = saved && patient === 'patient-a';
      const next = new URL(url);
      next.searchParams.set('startIndex', '1');
      return {
        data: {
          results: [{ uuid: `${current ? 'new' : 'old'}-${page}` }],
          links: page === 1 ? [{ rel: 'next', uri: next.toString() }] : [],
          totalCount: 2,
        },
      } as Awaited<ReturnType<typeof openmrsFetch>>;
    }
    if (url.pathname.endsWith('/Observation')) {
      return {
        data: {
          entry: [
            {
              resource: {
                code: { coding: [{ code: 'weight' }] },
                effectiveDateTime: '2026-10-10T10:00:00Z',
                valueQuantity: { value: saved ? 65 : 60 },
                encounter: { reference: 'Encounter/saved' },
              },
            },
          ],
          link: [],
          total: 1,
        },
      } as Awaited<ReturnType<typeof openmrsFetch>>;
    }
    if (url.pathname.endsWith('/concept/weight'))
      return { data: { uuid: 'weight' } } as Awaited<ReturnType<typeof openmrsFetch>>;
    throw new Error('Unexpected synthetic read');
  });
});

it('refreshes different paginated encounter readers and mapped observations after the native saved close', async () => {
  const closeWorkspace = vi.fn().mockResolvedValue(true);
  render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0, shouldRetryOnError: false }}>
      <EncounterReader view="selector" />
      <EncounterReader view="pregnancy" />
      <EncounterReader view="pregnancy" patient="patient-b" />
      <VisitHistory />
      <VisitHistory patient="patient-a-other" />
      <Observations />
      <Metadata />
      <FormEntry
        form={{
          uuid: 'synthetic-form',
          name: 'Synthetic form',
          version: '1',
          published: true,
          retired: false,
          resources: [],
        }}
        patientUuid="patient-a"
        patient={null}
        visitContext={null}
        mutateVisitContext={null}
        closeWorkspace={closeWorkspace}
        renderAsWorkspace2={false}
      />
    </SWRConfig>,
  );
  await waitFor(() => {
    expect(screen.getByLabelText('selector-patient-a')).toHaveTextContent('old-1,old-2');
    expect(screen.getByLabelText('pregnancy-patient-a')).toHaveTextContent('old-1,old-2');
    expect(screen.getByLabelText('pregnancy-patient-b')).toHaveTextContent('old-1,old-2');
    expect(screen.getByLabelText('observations')).toHaveTextContent('60');
    expect(screen.getByLabelText('visits-patient-a')).toHaveTextContent('old-1,old-2');
    expect(screen.getByLabelText('visits-patient-a-other')).toHaveTextContent('old-1,old-2');
    expect(screen.getByLabelText('metadata')).toHaveTextContent('ready');
  });
  vi.mocked(openmrsFetch).mockClear();
  await userEvent.click(screen.getByRole('button', { name: 'Confirmed encounter save' }));
  await waitFor(() => {
    expect(screen.getByLabelText('selector-patient-a')).toHaveTextContent('new-1,new-2');
    expect(screen.getByLabelText('pregnancy-patient-a')).toHaveTextContent('new-1,new-2');
    expect(screen.getByLabelText('observations')).toHaveTextContent('65');
    expect(screen.getByLabelText('visits-patient-a')).toHaveTextContent('new-1,new-2');
  });
  expect(screen.getByLabelText('pregnancy-patient-b')).toHaveTextContent('old-1,old-2');
  expect(vi.mocked(openmrsFetch).mock.calls.some(([url]) => String(url).includes('patient-b'))).toBe(false);
  expect(vi.mocked(openmrsFetch).mock.calls.some(([url]) => String(url).includes('/concept/'))).toBe(false);
  expect(screen.getByLabelText('visits-patient-a-other')).toHaveTextContent('old-1,old-2');
  expect(vi.mocked(openmrsFetch).mock.calls.some(([url]) => String(url).includes('patient-a-other'))).toBe(false);
  expect(closeWorkspace).toHaveBeenCalledWith({ discardUnsavedChanges: true });
});
