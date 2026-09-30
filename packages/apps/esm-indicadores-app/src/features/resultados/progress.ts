/**
 * Status bands for annual-goal progress. Institutional review chose fixed
 * thresholds over a computed pace: clinical teams run campaigns to catch up on
 * a lagging indicator, so a calendar-based expectation would mislead.
 */
export const META_STATUS_LOW_BELOW = 20;
export const META_STATUS_MEDIUM_BELOW = 60;

export type MetaStatus = 'low' | 'medium' | 'high';

export function calculateProgress(meta: number, currentValue: number): number {
  if (!Number.isFinite(meta) || !Number.isFinite(currentValue) || meta <= 0) {
    return 0;
  }
  const percentage = Math.round((currentValue / meta) * 100);
  return Math.min(100, Math.max(0, percentage));
}

export function getMetaStatus(percentage: number): MetaStatus {
  if (percentage < META_STATUS_LOW_BELOW) {
    return 'low';
  }
  if (percentage < META_STATUS_MEDIUM_BELOW) {
    return 'medium';
  }
  return 'high';
}
