export type ConditionStatusFilter = 'All' | 'Active' | 'Inactive';

export function isActiveConditionStatus(status?: string): boolean {
  return ['active', 'recurrence', 'relapse'].includes(status?.trim().toLowerCase() ?? '');
}

export function matchesConditionStatusFilter(status: string | undefined, filter: ConditionStatusFilter): boolean {
  if (filter === 'All') {
    return true;
  }
  return filter === 'Active'
    ? isActiveConditionStatus(status)
    : ['inactive', 'remission', 'resolved', 'history_of'].includes(status?.trim().toLowerCase() ?? '');
}

export function isSupportedConditionStatus(status?: string): boolean {
  return ['active', 'inactive', 'resolved', 'recurrence', 'relapse', 'remission'].includes(
    status?.trim().toLowerCase() ?? '',
  );
}
