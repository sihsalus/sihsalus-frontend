import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { normalizeDate } from './bulk-patient-import.utils';

describe('bulk patient import birthdates', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 13, 12));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it.each([
    ['13/07/1886', '1886-07-13'],
    ['29/02/2024', '2024-02-29'],
  ])('normalizes valid birthdate %s', (input, expected) => {
    expect(normalizeDate(input)).toBe(expected);
  });

  it.each(['12/07/1886', '14/07/2026', '31/04/2020', '01/01/100000'])('rejects invalid birthdate %s', (input) => {
    expect(normalizeDate(input)).toBe('');
  });
});
