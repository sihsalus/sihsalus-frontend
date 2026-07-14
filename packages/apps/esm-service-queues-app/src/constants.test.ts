import { getStartOfDay } from './constants';

describe('getStartOfDay', () => {
  const originalTimeZone = process.env.TZ;

  beforeAll(() => {
    process.env.TZ = 'America/Lima';
  });

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  afterAll(() => {
    process.env.TZ = originalTimeZone;
  });

  it('returns local midnight as its UTC instant in America/Lima', () => {
    vi.setSystemTime(new Date('2026-07-15T04:59:59.999Z'));

    expect(getStartOfDay()).toBe('2026-07-14T05:00:00.000Z');
  });

  it('recalculates the local calendar day after midnight', () => {
    vi.setSystemTime(new Date('2026-07-15T04:59:59.999Z'));
    expect(getStartOfDay()).toBe('2026-07-14T05:00:00.000Z');

    vi.setSystemTime(new Date('2026-07-15T05:00:00.000Z'));
    expect(getStartOfDay()).toBe('2026-07-15T05:00:00.000Z');
  });

  it('returns 00:00Z when the local timezone is UTC', () => {
    process.env.TZ = 'UTC';
    vi.setSystemTime(new Date('2026-07-15T18:00:00.000Z'));

    try {
      expect(getStartOfDay()).toBe('2026-07-15T00:00:00.000Z');
    } finally {
      process.env.TZ = 'America/Lima';
    }
  });
});
