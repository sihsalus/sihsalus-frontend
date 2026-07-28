import { Tag } from '@carbon/react';
import { WarningAlt } from '@carbon/react/icons';
import { useConfig } from '@openmrs/esm-framework';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { type Config } from '../../../config-schema';
import { useEmergencyConfig } from '../../../hooks/use-priority-config';
import { type EmergencyQueueTableCellProps } from './emergency-queue-name-cell.component';

export const EmergencyQueueStatusCell: React.FC<EmergencyQueueTableCellProps> = ({ queueEntry }) => {
  const { t } = useTranslation();
  const config = useConfig<Config>();
  const { emergencyTriageQueueUuid } = useEmergencyConfig();
  const statusDisplay = queueEntry.status?.display || '';

  const isInTriageQueue = queueEntry.queue?.uuid === emergencyTriageQueueUuid;
  const triageEncounterTypeUuid = config.triageEncounter.encounterTypeUuid;
  const hasTriageEncounter =
    queueEntry.visit?.encounters?.some((enc) => enc.encounterType?.uuid === triageEncounterTypeUuid && !enc.voided) ??
    false;
  const isTriagePending = !isInTriageQueue && !hasTriageEncounter;

  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
      <Tag type="gray" size="sm">
        {statusDisplay}
      </Tag>
      {isTriagePending && (
        <Tag type="red" size="sm" title={t('triagePending', 'Triaje pendiente')}>
          <WarningAlt size={12} />
        </Tag>
      )}
    </span>
  );
};
