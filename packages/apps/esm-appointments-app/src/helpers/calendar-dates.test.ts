import dayjs from 'dayjs';
import 'dayjs/locale/es';
import { monthDays } from './functions';

afterEach(() => {
  vi.useRealTimers();
});

test.each([
  '2026-01-01',
  '2026-12-01',
  '2027-01-01',
  '2028-02-01',
])('the month grid is contiguous across month and year boundaries: %s', (selectedDate) => {
  vi.useFakeTimers();
  // The year being viewed must not depend on the current year.
  vi.setSystemTime(new Date('2030-06-17T12:00:00'));
  const selected = dayjs(selectedDate).locale('es');
  const days = monthDays(selected);
  expect(days.length % 7).toBe(0);
  expect(days.length).toBeGreaterThanOrEqual(35);
  expect(days[0].day()).toBe(0);
  expect(days.at(-1).day()).toBe(6);
  days.forEach((day, index) => {
    expect(day.format('YYYY-MM-DD')).toBe(days[0].add(index, 'day').format('YYYY-MM-DD'));
    expect(day.day()).toBe(index % 7);
  });
  expect(days.filter((day) => day.isSame(selected, 'month'))).toHaveLength(selected.daysInMonth());
  expect(new Set(days.map((day) => day.format('YYYY-MM-DD'))).size).toBe(days.length);
});
