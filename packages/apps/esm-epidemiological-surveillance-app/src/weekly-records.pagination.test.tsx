import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { WeeklyRecordsPanel } from './weekly-records.component';
import { getWeeklyRecords } from './api';
import { catalogue } from './test-fixtures';
import { weeklyColumns, type WeeklyRow } from './weekly-records';

vi.mock('@openmrs/esm-framework', () => ({ openmrsFetch: vi.fn(), restBaseUrl: '/ws/rest/v1', fhirBaseUrl: '/ws/fhir2/R4' }));
vi.mock('./api', async (original) => ({
  ...(await original<typeof import('./api')>()),
  getWeeklyRecords: vi.fn(),
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.setSystemTime(new Date('2026-01-05T12:00:00Z'));
  vi.mocked(getWeeklyRecords).mockResolvedValue({
    year: 2026,
    week: 1,
    from: '2026-01-04',
    to: '2026-01-10',
    rows: Array.from({ length: 12 }, (_, index) => ({
      ...Object.fromEntries(weeklyColumns.map((key) => [key, null])),
      id: `synthetic-${index}`,
      year: 2026,
      week: 1,
      givenNames: `Synthetic ${index}`,
    }) as WeeklyRow),
  });
});

it('moves between pages and restarts at the first page when the size changes', async () => {
  render(<WeeklyRecordsPanel catalogue={catalogue} />);
  expect(await screen.findByText('Synthetic 0')).toBeInTheDocument();
  expect(screen.queryByText('Synthetic 11')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'tablePagination.next' }));
  expect(await screen.findByText('Synthetic 11')).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('tablePagination.size', { selector: 'select' }), {
    target: { value: '20' },
  });
  expect(await screen.findByText('Synthetic 0')).toBeInTheDocument();
  expect(screen.getByText('Synthetic 11')).toBeInTheDocument();
});
