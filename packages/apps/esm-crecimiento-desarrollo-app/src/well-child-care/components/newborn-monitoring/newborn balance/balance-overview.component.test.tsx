import { useConfig } from '@openmrs/esm-framework';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import en from '../../../../../translations/en.json';
import es from '../../../../../translations/es.json';
import ClinicalDataOverview from '../../../../ui/clinical-data/clinical-data-overview.component';
import { useBalance, useVitalsConceptMetadata } from '../../../common';
import NewbornBalanceOverview from './balance-overview.component';

vi.mock('../../../common', () => ({
  useBalance: vi.fn(),
  useVitalsConceptMetadata: vi.fn(),
  withUnit: (label: string, unit: string) => (unit ? `${label} (${unit})` : label),
}));
vi.mock('../../../../ui/clinical-data/clinical-data-overview.component', () => ({
  default: vi.fn(({ isLoading, error, tableRows }) =>
    isLoading ? <p>Loading balance</p> : error ? <p>Could not load balance</p> : <p>{JSON.stringify(tableRows)}</p>,
  ),
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => translations[key] ?? fallback ?? key,
  }),
}));

const setPage = vi.fn().mockResolvedValue([]);
const mutate = vi.fn().mockResolvedValue([]);
let translations: Record<string, string> = es;
const row = {
  id: 'synthetic-encounter',
  date: '2026-10-01T12:00:00Z',
  stoolCount: 0,
  stoolGrams: 10,
};
const balanceResult: ReturnType<typeof useBalance> = {
  data: [row],
  error: null,
  isLoading: false,
  isValidating: false,
  hasMore: false,
  loadingNewData: false,
  currentPage: 1,
  totalResults: 2,
  setPage,
  mutate,
};

beforeEach(() => {
  vi.clearAllMocks();
  translations = es;
  setPage.mockResolvedValue([]);
  mutate.mockResolvedValue([]);
  vi.mocked(useConfig).mockReturnValue({ concepts: {} });
  vi.mocked(useVitalsConceptMetadata).mockReturnValue({
    data: new Map(),
  } as ReturnType<typeof useVitalsConceptMetadata>);
  vi.mocked(useBalance).mockReturnValue(balanceResult as ReturnType<typeof useBalance>);
});

it.each([
  {
    language: 'es',
    labels: es,
    expected: ['Peso de deposiciones (gr)', 'Peso de orina (gr)', 'Densidad del vómito (gr/ml)'],
  },
  {
    language: 'en',
    labels: en,
    expected: ['Stool Weight (gr)', 'Urine Weight (gr)', 'Vomit Density (gr/ml)'],
  },
])('identifies historical quantities and metadata units in $language', ({ labels, expected }) => {
  translations = labels;
  vi.mocked(useConfig).mockReturnValue({
    concepts: {
      stoolGramsUuid: 'synthetic-stool-weight',
      urineGramsUuid: 'synthetic-urine-weight',
      vomitGramsMLUuid: 'synthetic-vomit-density',
    },
  });
  vi.mocked(useVitalsConceptMetadata).mockReturnValue({
    data: new Map([
      ['synthetic-stool-weight', 'gr'],
      ['synthetic-urine-weight', 'gr'],
      ['synthetic-vomit-density', 'gr/ml'],
    ]),
  } as ReturnType<typeof useVitalsConceptMetadata>);
  render(<NewbornBalanceOverview patientUuid="synthetic-child" />);
  const overviewProps = vi.mocked(ClinicalDataOverview).mock.lastCall?.[0];
  const quantityKeys = ['stoolGrams', 'urineGrams', 'vomitGramsML'];
  expect(
    overviewProps?.tableHeaders.filter(({ key }) => quantityKeys.includes(key)).map(({ header }) => header),
  ).toEqual(expected);
  expect(
    overviewProps?.chartConfig?.vitalSigns.filter(({ id }) => quantityKeys.includes(id)).map(({ title }) => title),
  ).toEqual(expected);
});

it('loads remaining observation pages before exposing a partial encounter or graph', () => {
  vi.mocked(useBalance).mockReturnValue({
    ...balanceResult,
    hasMore: true,
  } as ReturnType<typeof useBalance>);
  const { rerender } = render(<NewbornBalanceOverview patientUuid="synthetic-child" />);
  expect(screen.getByText('Loading balance')).toBeVisible();
  expect(setPage).toHaveBeenCalledTimes(1);
  expect(setPage.mock.calls[0][0](1)).toBe(2);
  vi.mocked(useBalance).mockReturnValue(balanceResult as ReturnType<typeof useBalance>);
  rerender(<NewbornBalanceOverview patientUuid="synthetic-child" />);
  expect(screen.queryByText('Loading balance')).not.toBeInTheDocument();
  expect(ClinicalDataOverview).toHaveBeenLastCalledWith(
    expect.objectContaining({
      tableRows: [
        expect.objectContaining({
          id: 'synthetic-encounter',
          stoolCount: 0,
          stoolGrams: 10,
          urineCount: '--',
        }),
      ],
    }),
    expect.anything(),
  );
});

it('does not request another page while loading or after a failed page', () => {
  vi.mocked(useBalance).mockReturnValue({
    ...balanceResult,
    hasMore: true,
    isValidating: true,
  } as ReturnType<typeof useBalance>);
  const { rerender } = render(<NewbornBalanceOverview patientUuid="synthetic-child" />);
  expect(setPage).not.toHaveBeenCalled();
  vi.mocked(useBalance).mockReturnValue({
    ...balanceResult,
    hasMore: true,
    error: new Error('private-error'),
  } as ReturnType<typeof useBalance>);
  rerender(<NewbornBalanceOverview patientUuid="synthetic-child" />);
  expect(screen.getByText('Could not load balance')).toBeVisible();
  expect(screen.queryByText('private-error')).not.toBeInTheDocument();
  expect(setPage).not.toHaveBeenCalled();
});

it('surfaces pagination rejection and allows retry without treating it as an empty history', async () => {
  setPage.mockRejectedValueOnce(new Error('private-page-error'));
  vi.mocked(useBalance).mockReturnValue({
    ...balanceResult,
    hasMore: true,
  } as ReturnType<typeof useBalance>);
  render(<NewbornBalanceOverview patientUuid="synthetic-child" />);
  expect(await screen.findByText('Could not load balance')).toBeVisible();
  expect(screen.queryByText('private-page-error')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
  await waitFor(() => expect(mutate).toHaveBeenCalledTimes(1));
});

it('does not carry a pagination error into another patient', async () => {
  setPage.mockRejectedValueOnce(new Error('private-page-error'));
  vi.mocked(useBalance).mockReturnValue({
    ...balanceResult,
    hasMore: true,
  } as ReturnType<typeof useBalance>);
  const { rerender } = render(<NewbornBalanceOverview patientUuid="synthetic-child" />);
  expect(await screen.findByText('Could not load balance')).toBeVisible();
  vi.mocked(useBalance).mockReturnValue({
    ...balanceResult,
    data: [],
  } as ReturnType<typeof useBalance>);
  rerender(<NewbornBalanceOverview patientUuid="synthetic-next-child" />);
  expect(screen.queryByText('Could not load balance')).not.toBeInTheDocument();
  expect(useBalance).toHaveBeenLastCalledWith('synthetic-next-child');
});
