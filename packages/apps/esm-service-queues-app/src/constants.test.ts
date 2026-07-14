import { getStartOfDay, timeZone } from './constants';

describe('getStartOfDay', () => {
  const originalTimeZone = process.env.TZ;

  beforeAll(() => {
    process.env.TZ = 'Asia/Tokyo';
  });

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  afterAll(() => {
    if (originalTimeZone === undefined) {
      delete process.env.TZ;
    } else {
      process.env.TZ = originalTimeZone;
    }
  });

  it('uses the hospital timezone independently of the browser timezone', () => {
    expect(timeZone).toBe('America/Lima');

    vi.setSystemTime(new Date('2026-07-15T04:59:59.999Z'));

    expect(getStartOfDay()).toBe('2026-07-14T05:00:00.000Z');
  });

  it('recalculates the Lima calendar day after midnight', () => {
    vi.setSystemTime(new Date('2026-07-15T04:59:59.999Z'));
    expect(getStartOfDay()).toBe('2026-07-14T05:00:00.000Z');

    vi.setSystemTime(new Date('2026-07-15T05:00:00.000Z'));
    expect(getStartOfDay()).toBe('2026-07-15T05:00:00.000Z');
  });

  it('keeps the Lima operational boundary when the browser timezone changes', () => {
    process.env.TZ = 'UTC';
    vi.setSystemTime(new Date('2026-07-15T18:00:00.000Z'));

    try {
      expect(getStartOfDay()).toBe('2026-07-15T05:00:00.000Z');
    } finally {
      process.env.TZ = 'Asia/Tokyo';
    }
  });
});
