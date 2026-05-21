vi.mock('@openmrs/esm-framework', async () => ({
  ...(await vi.importActual('@openmrs/esm-framework')),
  isOmrsDateStrict: vi.fn((value: string) => value.includes('T')),
  parseDate: vi.fn((value: string) => new Date(value)),
}));

import { fromFormDateToOpenmrs, isValidOpenmrsDate, toOpenmrsIsoString } from './date-utils';

describe('maternal utils/date-utils', () => {
  it('formats dates to OpenMRS ISO strings without timezone conversion when requested', () => {
    expect(
      toOpenmrsIsoString('2025-01-15', {
        includeTime: false,
        useTimezone: false,
      }),
    ).toMatch(/^2025-01-15T00:00:00\.000[+-]\d{4}$/);

    expect(
      toOpenmrsIsoString(new Date(2025, 0, 15, 13, 45, 30), {
        useTimezone: false,
      }),
    ).toMatch(/^2025-01-15T13:45:30\.000[+-]\d{4}$/);
  });

  it('validates OpenMRS date strings and converts form dates with time', () => {
    const openmrsDate = fromFormDateToOpenmrs('2025-01-15', '08:30');

    expect(openmrsDate).toMatch(/^2025-01-15T08:30:00\.000[+-]\d{4}$/);
    expect(isValidOpenmrsDate(openmrsDate)).toBe(true);
    expect(isValidOpenmrsDate('2025-01-15')).toBe(false);
  });
});
