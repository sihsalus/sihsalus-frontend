import type { TFunction } from 'i18next';
import type { ExportCell } from './report-export';

export const weeklyColumns = [
  'year',
  'week',
  'paternalSurname',
  'maternalSurname',
  'givenNames',
  'age',
  'sex',
  'dni',
  'province',
  'district',
  'locality',
  'residence',
  'ethnicity',
  'habitualResidence',
  'icd10',
  'diagnosisType',
  'vaccinationStatus',
  'onsetDate',
  'deathDate',
  'investigationDate',
  'notificationDate',
  'investigationForm',
  'surveillanceType',
] as const;

export type WeeklyRow = { id: string } & Record<(typeof weeklyColumns)[number], string | number | boolean | null>;
export interface WeeklyRecords {
  year: number;
  week: number;
  from: string;
  to: string;
  rows: WeeklyRow[];
}

export function weeklyCells(row: WeeklyRow): ExportCell[] {
  return weeklyColumns.map((key) => {
    const value = row[key];
    if (value === null || value === undefined) return '';
    if (key === 'investigationForm') return value ? 'S' : 'N';
    if (key === 'diagnosisType')
      return { CONFIRMADO: 'C', PROBABLE: 'P', DESCARTADO: 'D' }[String(value)] ?? String(value);
    if (key === 'vaccinationStatus') return { SI: 'S', NO: 'N', IGN: 'I' }[String(value)] ?? String(value);
    if (key === 'surveillanceType') return { PASIVA: 'P', BUSQUEDA_ACTIVA: 'A' }[String(value)] ?? '';
    // Preserve text identifiers and leading zeros; only ages, years and weeks are numeric.
    return typeof value === 'number' ? value : String(value);
  });
}

export function weeklyExportRows(rows: WeeklyRow[], t: TFunction): ExportCell[][] {
  return [weeklyColumns.map((key) => t(`weekly.columns.${key}`)), ...rows.map((row) => weeklyCells(row))];
}
