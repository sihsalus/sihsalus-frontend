import dayjs from 'dayjs';

import { monthDays } from './utils';

describe('monthDays', () => {
  it('preserves the previous and next year around a January calendar', () => {
    const days = monthDays(dayjs('2027-01-15'));

    expect(days[0]?.format('YYYY-MM-DD')).toBe('2026-12-27');
    expect(days.at(-1)?.format('YYYY-MM-DD')).toBe('2027-02-06');
    expect(new Set(days.map((day) => day.format('YYYY-MM-DD'))).size).toBe(days.length);
  });

  it('preserves the next year around a December calendar', () => {
    const days = monthDays(dayjs('2026-12-15'));

    expect(days[0]?.format('YYYY-MM-DD')).toBe('2026-11-29');
    expect(days.at(-1)?.format('YYYY-MM-DD')).toBe('2027-01-02');
  });
});
