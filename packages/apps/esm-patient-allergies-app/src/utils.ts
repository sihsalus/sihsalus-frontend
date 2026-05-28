import type { ReactionSeverity } from './types';

export const severityOrder: Partial<Record<ReactionSeverity, number>> = {
  severe: 1,
  moderate: 2,
  mild: 3,
};
