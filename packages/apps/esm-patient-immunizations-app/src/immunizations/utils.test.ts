import type { ExistingDoses } from '../types';
import { latestFirst } from './utils';

const dose = (overrides: Partial<ExistingDoses>): ExistingDoses =>
  ({
    immunizationObsUuid: overrides.immunizationObsUuid ?? overrides.doseNumber?.toString() ?? 'dose',
    occurrenceDateTime: '2026-10-16T00:00:00.000Z',
    note: [],
    expirationDate: '',
    lotNumber: '',
    manufacturer: '',
    nextDoseDate: '',
    ...overrides,
  }) as ExistingDoses;

describe('latestFirst', () => {
  it('orders doses from the most recent date to the oldest', () => {
    const sorted = [
      dose({ immunizationObsUuid: 'old', occurrenceDateTime: '2026-01-01T00:00:00.000Z', doseNumber: 3 }),
      dose({ immunizationObsUuid: 'new', occurrenceDateTime: '2026-10-16T00:00:00.000Z', doseNumber: 1 }),
    ].sort(latestFirst);

    expect(sorted.map((item) => item.immunizationObsUuid)).toEqual(['new', 'old']);
  });

  it('puts the highest dose number first when several doses share the same date', () => {
    const sorted = [dose({ doseNumber: 1 }), dose({ doseNumber: 2 }), dose({ doseNumber: 3 })].sort(latestFirst);

    expect(sorted.map((item) => item.doseNumber)).toEqual([3, 2, 1]);
  });

  it('compares calendar dates regardless of time-of-day representation', () => {
    const sorted = [
      dose({ immunizationObsUuid: 'first', occurrenceDateTime: '2026-10-16T00:00:00.000Z', doseNumber: 1 }),
      dose({ immunizationObsUuid: 'third', occurrenceDateTime: '2026-10-16T00:00:00+00:00', doseNumber: 3 }),
    ].sort(latestFirst);

    expect(sorted.map((item) => item.immunizationObsUuid)).toEqual(['third', 'first']);
  });

  it('places doses without a dose number after numbered doses of the same date', () => {
    const sorted = [
      dose({ immunizationObsUuid: 'no-dose', doseNumber: undefined }),
      dose({ immunizationObsUuid: 'dose-2', doseNumber: 2 }),
      dose({ immunizationObsUuid: 'dose-1', doseNumber: 1 }),
    ].sort(latestFirst);

    expect(sorted.map((item) => item.immunizationObsUuid)).toEqual(['dose-2', 'dose-1', 'no-dose']);
  });

  it('places doses without a valid date last', () => {
    const sorted = [
      dose({ immunizationObsUuid: 'undated', occurrenceDateTime: '', doseNumber: 9 }),
      dose({ immunizationObsUuid: 'dated', occurrenceDateTime: '2020-01-01T00:00:00.000Z', doseNumber: 1 }),
    ].sort(latestFirst);

    expect(sorted.map((item) => item.immunizationObsUuid)).toEqual(['dated', 'undated']);
  });
});
