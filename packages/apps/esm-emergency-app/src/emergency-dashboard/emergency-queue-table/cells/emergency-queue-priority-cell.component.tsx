import { Tag } from '@carbon/react';
import { useConfig } from '@openmrs/esm-framework';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { type Config } from '../../../config-schema';
import { usePriorityConfig } from '../../../hooks/use-priority-config';
import { type EmergencyQueueTableCellProps } from './emergency-queue-name-cell.component';
import styles from './emergency-queue-priority-cell.scss';

export const EmergencyQueuePriorityCell: React.FC<EmergencyQueueTableCellProps> = ({ queueEntry }) => {
  const { t } = useTranslation();
  const config = useConfig<Config>();
  const priorityDisplay = queueEntry.priority?.display || '';
  const { getPriorityByUuid } = usePriorityConfig();
  const priorityUuid = queueEntry.priority?.uuid || '';

  // Check post-triage priorities (I-IV) first, then pre-triage (Emergencia/Urgencia)
  const priorityConfig = getPriorityByUuid(priorityUuid);

  const resolved = useMemo(() => {
    // Post-triage priority found in priorityConfigs (I-IV)
    if (priorityConfig) {
      return { label: priorityConfig.label, color: priorityConfig.color };
    }
    // Pre-triage: Emergencia
    if (priorityUuid === config.concepts.emergencyConceptUuid) {
      return { label: t('emergency', 'Emergencia'), color: 'red' };
    }
    // Pre-triage: Urgencia
    if (priorityUuid === config.concepts.urgencyConceptUuid) {
      return { label: t('urgency', 'Urgencia'), color: 'green' };
    }
    // Fallback: unknown priority — display name from backend with warning indicator
    return { label: priorityDisplay || t('unknownPriority', 'Sin prioridad'), color: 'gray' };
  }, [
    priorityConfig,
    priorityUuid,
    config.concepts.emergencyConceptUuid,
    config.concepts.urgencyConceptUuid,
    priorityDisplay,
    t,
  ]);

  const getPriorityProps = (color: string) => {
    if (color === 'red') {
      return { type: 'red' as const, className: styles.boldTag };
    } else if (color === 'orange') {
      return { type: undefined, className: styles.orangeTag };
    } else if (color === 'yellow') {
      return { type: undefined, className: styles.yellowTag };
    } else if (color === 'green') {
      return { type: 'green' as const, className: styles.boldTag };
    }
    return { type: 'gray' as const, className: styles.boldTag };
  };

  const { type, className } = getPriorityProps(resolved.color);

  return (
    <div className={styles.cellContainer}>
      <Tag type={type} className={className} size="sm">
        {resolved.label}
      </Tag>
    </div>
  );
};
