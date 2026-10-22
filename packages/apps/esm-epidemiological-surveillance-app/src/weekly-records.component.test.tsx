import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { Workbook } from 'exceljs';
import { WeeklyRecordsPanel } from './weekly-records.component';
import { getWeeklyRecords } from './api';
import { catalogue } from './test-fixtures';
import { weeklyColumns, weeklyCells, type WeeklyRecords, type WeeklyRow } from './weekly-records';
import { downloadBlob } from './report-export';

vi.mock('./api', async (original) => ({
  ...(await original<typeof import('./api')>()),
  getWeeklyRecords: vi.fn(),
}));
vi.mock('./report-export', async (original) => ({
  ...(await original<typeof import('./report-export')>()),
  downloadBlob: vi.fn(),
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

function result(year = 2026, week = 1): WeeklyRecords {
  return {
    year,
    week,
    from: '2026-01-04',
    to: '2026-01-10',
    rows: Array.from(
      { length: 12 },
      (_, index) =>
        ({
          ...Object.fromEntries(weeklyColumns.map((key) => [key, null])),
          id: `synthetic-${index}`,
          year,
          week,
          givenNames: `Synthetic ${index}`,
          dni: '00123456',
          age: 0,
          ethnicity: 'Synthetic ethnicity',
          investigationForm: true,
          province: '0101',
          district: '010101',
          locality: '0101010001',
          residence: '0101010002',
          icd10: 'A972',
          surveillanceType: 'PASIVA',
        }) as WeeklyRow,
    ),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.setSystemTime(new Date('2026-01-05T12:00:00Z'));
  vi.mocked(getWeeklyRecords).mockResolvedValue(result());
});

async function readBlob(blob: Blob, asText = false): Promise<ArrayBuffer | string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer | string);
    if (asText) reader.readAsText(blob);
    else reader.readAsArrayBuffer(blob);
  });
}

it('shows all record columns and exports every page, preserving DNI and numeric age', async () => {
  render(<WeeklyRecordsPanel catalogue={catalogue} />);
  await screen.findByText('Synthetic 0');
  expect(screen.queryByText('Synthetic 11')).toBeNull();
  expect(screen.getAllByRole('columnheader')).toHaveLength(weeklyColumns.length);
  expect(getWeeklyRecords).toHaveBeenCalledWith(2026, 1, expect.any(AbortSignal));
  fireEvent.click(screen.getByRole('button', { name: 'export.open' }));
  fireEvent.click(screen.getByRole('menuitem', { name: 'export.csv' }));
  await waitFor(() => expect(downloadBlob).toHaveBeenCalledTimes(1));
  const csv = await readBlob(vi.mocked(downloadBlob).mock.calls[0][0], true);
  expect(csv).toContain('"Synthetic 11"');
  expect(csv).toContain('"00123456"');
  expect(csv).toContain('"0101010001"');
  expect(csv).not.toContain('"weekly.columns.establishment"');
  expect(csv).not.toContain('"weekly.columns.diagnosis"');
  fireEvent.click(screen.getByRole('button', { name: 'export.open' }));
  fireEvent.click(screen.getByRole('menuitem', { name: 'export.xlsx' }));
  await waitFor(() => expect(downloadBlob).toHaveBeenCalledTimes(2));
  const workbook = new Workbook();
  await workbook.xlsx.load((await readBlob(vi.mocked(downloadBlob).mock.calls[1][0])) as ArrayBuffer);
  const sheet = workbook.worksheets[0];
  expect(sheet.rowCount).toBe(13);
  expect(sheet.getCell(2, weeklyColumns.indexOf('dni') + 1).value).toBe('00123456');
  expect(sheet.getCell(2, weeklyColumns.indexOf('age') + 1).value).toBe(0);
  for (const [key, expected] of Object.entries({
    province: '0101',
    district: '010101',
    locality: '0101010001',
    residence: '0101010002',
    icd10: 'A972',
    investigationForm: 'S',
    surveillanceType: 'P',
  })) {
    expect(sheet.getCell(2, weeklyColumns.indexOf(key as (typeof weeklyColumns)[number]) + 1).value).toBe(expected);
  }
});

it('renders negative investigation forms and active surveillance with report codes', () => {
  const cells = weeklyCells({ ...result().rows[0], investigationForm: false, surveillanceType: 'BUSQUEDA_ACTIVA' });
  expect(cells[weeklyColumns.indexOf('investigationForm')]).toBe('N');
  expect(cells[weeklyColumns.indexOf('surveillanceType')]).toBe('A');
});

it('clears stale data on a changed filter, ignores late responses and supports empty weeks', async () => {
  let resolveOld!: (value: WeeklyRecords) => void;
  vi.mocked(getWeeklyRecords).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        resolveOld = resolve;
      }),
  );
  render(<WeeklyRecordsPanel catalogue={catalogue} />);
  fireEvent.change(screen.getByLabelText('weekly.week'), {
    target: { value: '2' },
  });
  vi.mocked(getWeeklyRecords).mockResolvedValue({
    ...result(2026, 3),
    rows: [],
  });
  fireEvent.change(screen.getByLabelText('weekly.week'), {
    target: { value: '3' },
  });
  await screen.findByText('weekly.empty');
  await act(async () => resolveOld(result()));
  expect(screen.queryByText('Synthetic 0')).toBeNull();
  fireEvent.change(screen.getByLabelText('weekly.year'), {
    target: { value: '2025' },
  });
  expect(screen.queryByRole('button', { name: 'export.open' })).toBeNull();
  expect(screen.getByRole('option', { name: 'S53' })).toBeTruthy();
});

it('shows a safe error and retries without an export of stale rows', async () => {
  vi.mocked(getWeeklyRecords).mockRejectedValueOnce(new Error('private database details'));
  render(<WeeklyRecordsPanel catalogue={catalogue} />);
  fireEvent.click(await screen.findByRole('button', { name: 'retry' }));
  await screen.findByText('Synthetic 0');
  expect(screen.queryByText('private database details')).toBeNull();
});
