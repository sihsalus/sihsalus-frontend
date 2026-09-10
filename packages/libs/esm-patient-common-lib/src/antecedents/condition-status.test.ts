import { isActiveConditionStatus, isSupportedConditionStatus, matchesConditionStatusFilter } from './condition-status';

describe('condition status filters', () => {
  it.each([
    'active',
    'recurrence',
    'relapse',
    'Active',
    ' RELAPSE ',
  ])('includes %s among active conditions', (status) => {
    expect(isActiveConditionStatus(status)).toBe(true);
    expect(matchesConditionStatusFilter(status, 'Active')).toBe(true);
    expect(matchesConditionStatusFilter(status, 'Inactive')).toBe(false);
    expect(matchesConditionStatusFilter(status, 'All')).toBe(true);
  });

  it.each([
    'inactive',
    'remission',
    'resolved',
    'Inactive',
    ' RESOLVED ',
    'HISTORY_OF',
    ' History_of ',
  ])('includes %s among inactive conditions', (status) => {
    expect(isActiveConditionStatus(status)).toBe(false);
    expect(matchesConditionStatusFilter(status, 'Active')).toBe(false);
    expect(matchesConditionStatusFilter(status, 'Inactive')).toBe(true);
    expect(matchesConditionStatusFilter(status, 'All')).toBe(true);
  });

  it.each([
    undefined,
    '',
    'unknown',
    'entered-in-error',
  ])('retains unknown status %s only in All without inventing a state', (status) => {
    expect(isActiveConditionStatus(status)).toBe(false);
    expect(matchesConditionStatusFilter(status, 'Active')).toBe(false);
    expect(matchesConditionStatusFilter(status, 'Inactive')).toBe(false);
    expect(matchesConditionStatusFilter(status, 'All')).toBe(true);
  });
});

describe('supported condition statuses', () => {
  it.each([
    'ACTIVE',
    'inactive',
    'resolved',
    'recurrence',
    'relapse',
    ' Remission ',
  ])('allows the supported state %s without coercion', (status) =>
    expect(isSupportedConditionStatus(status)).toBe(true));
  it.each([undefined, '', 'HISTORY_OF', 'unknown'])('does not allow rewriting %s', (status) => {
    expect(isSupportedConditionStatus(status)).toBe(false);
  });
});
