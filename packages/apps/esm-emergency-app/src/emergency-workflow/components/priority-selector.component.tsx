/**
 * Priority Selector Component
 *
 * Allows users to select an emergency priority level for a patient.
 * Displays the 4 priority levels according to Peruvian technical standards.
 */

import { InlineNotification, RadioButton, RadioButtonGroup } from '@carbon/react';
import { Warning } from '@carbon/react/icons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { usePriorityConfig } from '../../hooks/use-priority-config';
import styles from './priority-selector.component.scss';

interface PrioritySelectorProps {
  selectedPriorityUuid?: string;
  onChange: (priorityUuid: string) => void;
  disabled?: boolean;
}

const PrioritySelector: React.FC<PrioritySelectorProps> = ({ selectedPriorityUuid, onChange, disabled = false }) => {
  const { t } = useTranslation();
  const { getAllPriorities, getPriorityByUuid } = usePriorityConfig();
  const priorities = getAllPriorities();

  const getPriorityDescription = (code: string) => {
    switch (code) {
      case 'PRIORITY_I':
        return t(
          'priorityIDescription',
          'Paciente cuya condición clínica puede poner en riesgo inminente su vida, función vital u órgano.',
        );
      case 'PRIORITY_II':
        return t(
          'priorityIIDescription',
          'Paciente con riesgo de complicación o descompensación de la enfermedad o lesión actual.',
        );
      case 'PRIORITY_III':
        return t(
          'priorityIIIDescription',
          'Paciente con condición aguda, sin riesgo vital actual, que necesita atención en el día.',
        );
      case 'PRIORITY_IV':
        return t(
          'priorityIVDescription',
          'Paciente con condición crónica, sin evidencia de deterioro reciente que necesita atención.',
        );
      default:
        return '';
    }
  };

  const getPriorityColorClass = (code: string) => {
    switch (code) {
      case 'PRIORITY_I':
        return styles.priorityI;
      case 'PRIORITY_II':
        return styles.priorityII;
      case 'PRIORITY_III':
        return styles.priorityIII;
      case 'PRIORITY_IV':
        return styles.priorityIV;
      default:
        return '';
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Warning size={20} className={styles.warningIcon} />
        <h6>{t('selectEmergencyPriority', 'Seleccione la prioridad de emergencia')}</h6>
      </div>

      <InlineNotification
        kind="info"
        lowContrast
        hideCloseButton
        subtitle={t(
          'prioritySelectionInfo',
          'Seleccione el nivel de prioridad según la evaluación inicial del paciente. Esto determinará el orden de atención.',
        )}
      />

      <div className={styles.priorityOptions}>
        <RadioButtonGroup
          name="emergency-priority"
          valueSelected={selectedPriorityUuid || ''}
          onChange={onChange}
          orientation="vertical"
        >
          {priorities.map((priority) => {
            const priorityConfig = getPriorityByUuid(priority.uuid);
            const priorityCode = priorityConfig?.code || '';
            const maxWaitTime = priorityConfig?.maxWaitTimeMinutes || 0;

            const labelContent = (
              <div className={styles.priorityContent}>
                <div className={styles.priorityHeader}>
                  <span className={styles.priorityLabel}>{priority.label}</span>
                  <span className={styles.priorityWaitTime}>
                    {priority.sortWeight === 1
                      ? t('immediate', 'Inmediato')
                      : t('maxWaitMinutes', '< {{minutes}} min', { minutes: maxWaitTime })}
                  </span>
                </div>
                <p className={styles.priorityDescription}>{getPriorityDescription(priorityCode)}</p>
              </div>
            );

            return (
              <RadioButton
                key={priority.uuid}
                value={priority.uuid}
                labelText={labelContent}
                disabled={disabled}
                className={`${styles.priorityOption} ${getPriorityColorClass(priorityCode)}`}
              />
            );
          })}
        </RadioButtonGroup>
      </div>

      {!selectedPriorityUuid && (
        <InlineNotification
          kind="warning"
          lowContrast
          hideCloseButton
          subtitle={t('pleaseSelectPriority', 'Por favor seleccione una prioridad antes de continuar.')}
        />
      )}
    </div>
  );
};

export default PrioritySelector;
