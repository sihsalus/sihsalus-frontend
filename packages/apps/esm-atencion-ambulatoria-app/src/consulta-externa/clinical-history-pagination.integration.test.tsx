import {
  getCoreTranslation,
  getDefaultsFromConfigSchema,
  openmrsFetch,
  useConfig,
  useLayoutType,
} from '@openmrs/esm-framework';
import { render, screen } from '@testing-library/react';
import { SWRConfig } from 'swr';
import OutPatientSocialHistory from '../clinical-encounter/summary/out-patient-summary/patient-social-history.component';
import { configSchema } from '../config-schema';
import { type ClinicalHistorySource, useMergedClinicalHistoryPagination } from '../hooks/useClinicalHistoryPagination';
import ClinicalHistoryCard from './clinical-history-card.component';

vi.mock('../hooks/useSocialHistoryFormLauncher', () => ({ useSocialHistoryFormLauncher: () => vi.fn() }));

const config = getDefaultsFromConfigSchema(configSchema);
const mockFetch = vi.mocked(openmrsFetch);
const safeError = getCoreTranslation('errorLoadingInformation');
const sources = [{ url: '/encounter?source=broken' }, { url: '/encounter?source=valid' }];

function History({ sources }: { sources: Array<ClinicalHistorySource> }) {
  const history = useMergedClinicalHistoryPagination<{ uuid: string; encounterDatetime: string }>(sources);
  return (
    <ClinicalHistoryCard
      title="Synthetic history"
      emptyDisplayText="records"
      empty={history.data.length === 0}
      isLoading={history.isLoading}
      error={history.error}
      sourceErrors={history.sourceErrors}
      pagination={history.pagination}
    >
      <ul>
        {history.data.map((entry) => (
          <li key={entry.uuid}>{entry.uuid}</li>
        ))}
      </ul>
    </ClinicalHistoryCard>
  );
}

function renderHistory(component = <History sources={sources} />) {
  return render(
    <SWRConfig value={{ provider: () => new Map(), shouldRetryOnError: false, revalidateOnFocus: false }}>
      {component}
    </SWRConfig>,
  );
}

beforeEach(() => {
  mockFetch.mockReset();
  vi.mocked(useConfig).mockReturnValue(config);
  vi.mocked(useLayoutType).mockReturnValue('small-desktop');
});

it('shows an error for an incomplete social history and retains the legacy history', async () => {
  mockFetch.mockResolvedValueOnce({ data: { results: [], totalCount: 2 } } as never);
  renderHistory(
    <OutPatientSocialHistory
      {...({
        patientUuid: 'synthetic-patient',
        encounters: [
          {
            uuid: 'legacy',
            encounterDatetime: '2026-09-23T10:00:00Z',
            obs: [{ concept: { uuid: config.concepts.alcoholUseUuid }, value: 'Synthetic legacy record' }],
          },
        ],
        isLoading: false,
        isValidating: false,
        error: undefined,
        mutate: vi.fn(),
      } as never)}
    />,
  );

  expect(await screen.findByText(safeError)).toBeInTheDocument();
  expect(screen.getByRole('table', { name: 'Previous social history records' })).toBeInTheDocument();
  expect(screen.queryByRole('table', { name: 'Social History' })).not.toBeInTheDocument();
  expect(screen.queryByText(/There are no social history/)).not.toBeInTheDocument();
  expect(screen.queryByText('inconsistent-clinical-history-page')).not.toBeInTheDocument();
});

it('does not claim an empty history when the only successful source is empty', async () => {
  mockFetch.mockImplementation((url) =>
    Promise.resolve({ data: { results: [], totalCount: String(url).includes('broken') ? 2 : 0 } } as never),
  );
  renderHistory();

  expect(await screen.findByText(safeError)).toBeInTheDocument();
  expect(screen.queryByText(/There are no records/)).not.toBeInTheDocument();
});

it('keeps verified records visible together with the partial-history warning', async () => {
  mockFetch.mockImplementation((url) =>
    Promise.resolve({
      data: String(url).includes('broken')
        ? { results: [], totalCount: 2 }
        : { results: [{ uuid: 'verified-record', encounterDatetime: '2026-09-23T10:00:00Z' }], totalCount: 1 },
    } as never),
  );
  renderHistory();

  expect(await screen.findByText('Historial incompleto')).toBeInTheDocument();
  expect(screen.getByText('verified-record')).toBeInTheDocument();
  expect(screen.queryByText(safeError)).not.toBeInTheDocument();
});

it('still shows an empty state when every source was read successfully', async () => {
  mockFetch.mockResolvedValue({ data: { results: [], totalCount: 0 } } as never);
  renderHistory();

  expect(await screen.findByText('There are no records to display for this patient')).toBeInTheDocument();
  expect(screen.queryByText(safeError)).not.toBeInTheDocument();
});
