import { isVersionSatisfied } from '@openmrs/esm-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import routes from '../routes.json';
import { getQueueEntryDateCriteria, parseQueueEntryDate, serializeQueueEntryDate } from './queue-entry-date';

afterEach(() => vi.unstubAllEnvs());

it('accepts the installed Queue release and requires the native timezone-aware parser', () => {
  expect(isVersionSatisfied(routes.backendDependencies.queue, '3.1.0-sihsalus.1')).toBe(true);
  expect(isVersionSatisfied(routes.backendDependencies.queue, '3.1.0')).toBe(true);
  expect(isVersionSatisfied(routes.backendDependencies.queue, '3.0.0')).toBe(false);
});

describe('queue entry day in the browser timezone', () => {
  it.each([null, undefined, '', '2026-02-30', 'not-a-date', '2026-10-11T00:00:00Z'])(
    'does not apply a date criterion for %s',
    (value) => expect(getQueueEntryDateCriteria(value)).toEqual({}),
  );

  it.each([
    ['UTC', '2026-10-11', '2026-10-11T00:00:00.000Z', '2026-10-11T23:59:59.999Z'],
    ['America/Lima', '2026-10-11', '2026-10-11T05:00:00.000Z', '2026-10-12T04:59:59.999Z'],
    ['America/New_York', '2026-03-08', '2026-03-08T05:00:00.000Z', '2026-03-09T03:59:59.999Z'],
    ['America/Lima', '2026-12-31', '2026-12-31T05:00:00.000Z', '2027-01-01T04:59:59.999Z'],
  ])('includes the whole local day in %s', (timezone, day, firstInstant, lastInstant) => {
    vi.stubEnv('TZ', timezone);
    expect(getQueueEntryDateCriteria(day)).toEqual({
      startedOnOrAfter: firstInstant,
      startedOnOrBefore: lastInstant,
    });
  });

  it('persists the local calendar date rather than the UTC date after midnight', () => {
    vi.stubEnv('TZ', 'America/Lima');
    const date = new Date('2026-10-12T04:30:00Z');
    expect(serializeQueueEntryDate(date)).toBe('2026-10-11');
    expect(parseQueueEntryDate('2026-10-11')?.getHours()).toBe(0);
    expect(serializeQueueEntryDate(new Date('invalid'))).toBeNull();
  });
});
