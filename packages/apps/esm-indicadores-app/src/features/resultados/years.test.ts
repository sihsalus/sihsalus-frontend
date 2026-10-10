import { describe, expect, it } from 'vitest';

import { YEAR_OPTIONS_LOOKBACK, currentYear, indicatorYearOptions } from './years';

describe('indicatorYearOptions', () => {
  it('lists the current year plus the previous N, newest first', () => {
    const years = indicatorYearOptions();

    expect(years[0]).toBe(currentYear());
    expect(years).toHaveLength(YEAR_OPTIONS_LOOKBACK + 1);
    expect(years[years.length - 1]).toBe(currentYear() - YEAR_OPTIONS_LOOKBACK);
  });
});
