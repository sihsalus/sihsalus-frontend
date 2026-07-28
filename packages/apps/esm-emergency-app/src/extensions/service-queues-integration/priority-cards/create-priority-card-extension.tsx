import React from 'react';
import { useTranslation } from 'react-i18next';
import { PriorityLevelCard } from '../../../emergency-dashboard/priority-level-cards/priority-level-card.component';
import { usePriorityConfig } from '../../../hooks/use-priority-config';
import { usePatientsByPriority } from '../../../resources/emergency.resource';

type PriorityLevel = 'I' | 'II' | 'III' | 'IV';
type PriorityCode = 'PRIORITY_I' | 'PRIORITY_II' | 'PRIORITY_III' | 'PRIORITY_IV';
type CountKey = 'priorityI' | 'priorityII' | 'priorityIII' | 'priorityIV';
type CardColor = 'red' | 'orange' | 'yellow' | 'green' | 'blue';

interface PriorityCardConfig {
  level: PriorityLevel;
  code: PriorityCode;
  countKey: CountKey;
  tooltipKey: string;
  tooltipDefault: string;
}

const VALID_COLORS: ReadonlySet<string> = new Set(['red', 'orange', 'yellow', 'green', 'blue']);

function mapColor(color: string): CardColor {
  return VALID_COLORS.has(color) ? (color as CardColor) : 'red';
}

/**
 * Factory function that creates a priority card extension component.
 * Eliminates duplication across the 4 priority card wrappers (I–IV)
 * by parameterizing the priority level, code, and tooltip.
 */
export function createPriorityCardExtension(config: PriorityCardConfig): React.FC<{ queueUuid?: string }> {
  const PriorityCardExtension: React.FC<{ queueUuid?: string }> = ({ queueUuid }) => {
    const { t } = useTranslation();
    const { counts, isLoading } = usePatientsByPriority(undefined, undefined, queueUuid);
    const { getPriorityByCode } = usePriorityConfig();

    if (isLoading) {
      return null;
    }

    const priority = getPriorityByCode(config.code);
    if (!priority) {
      return null;
    }

    return (
      <PriorityLevelCard
        level={config.level}
        label={priority.label}
        description={priority.description}
        count={counts[config.countKey]}
        color={mapColor(priority.color)}
        tooltipText={t(config.tooltipKey, config.tooltipDefault)}
      />
    );
  };

  PriorityCardExtension.displayName = `EmergencyPriority${config.level}Card`;
  return PriorityCardExtension;
}
