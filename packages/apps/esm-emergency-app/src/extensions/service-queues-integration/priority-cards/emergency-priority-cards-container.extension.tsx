import { useTranslation } from 'react-i18next';
import { PriorityLevelCard } from '../../../emergency-dashboard/priority-level-cards/priority-level-card.component';
import { usePriorityConfig } from '../../../hooks/usePriorityConfig';
import { usePatientsByPriority } from '../../../resources/emergency.resource';
import styles from './emergency-priority-cards-container.scss';

export default function EmergencyPriorityCardsContainer() {
  const { t } = useTranslation();
  const { counts, isLoading } = usePatientsByPriority();
  const { getPriorityByCode } = usePriorityConfig();

  if (isLoading) {
    return null;
  }

  const mapColor = (color: string): 'red' | 'blue' | 'green' | 'orange' => {
    if (color === 'red' || color === 'blue' || color === 'green' || color === 'orange') {
      return color;
    }
    return 'red';
  };

  const priorityI = getPriorityByCode('PRIORITY_I');
  const priorityII = getPriorityByCode('PRIORITY_II');
  const priorityIII = getPriorityByCode('PRIORITY_III');
  const priorityIV = getPriorityByCode('PRIORITY_IV');

  if (!priorityI || !priorityII || !priorityIII || !priorityIV) {
    return null;
  }

  return (
    <div className={styles.priorityCardsContainer}>
      <PriorityLevelCard
        level="I"
        label={priorityI.label}
        description={priorityI.description}
        count={counts.priorityI}
        color={mapColor(priorityI.color)}
        tooltipText={t(
          'priorityITooltip',
          'Pacientes con alteración súbita y crítica del estado de salud, en riesgo inminente de muerte y que requieren atención inmediata en la Sala de Reanimación - Shock Trauma.',
        )}
      />
      <PriorityLevelCard
        level="II"
        label={priorityII.label}
        description={priorityII.description}
        count={counts.priorityII}
        color={mapColor(priorityII.color)}
        tooltipText={t(
          'priorityIITooltip',
          'Pacientes portadores de cuadro súbito, agudo con riesgo de muerte o complicaciones serias, cuya atención debe realizarse en un tiempo de espera no mayor o igual de 10 minutos desde su ingreso. Serán atendidos en Consultorios de Emergencia.',
        )}
      />
      <PriorityLevelCard
        level="III"
        label={priorityIII.label}
        description={priorityIII.description}
        count={counts.priorityIII}
        color={mapColor(priorityIII.color)}
        tooltipText={t(
          'priorityIIITooltip',
          'Pacientes que no presentan riesgo de muerte ni secuelas invalidantes. Amerita atención en el Tópico de Emergencia, teniendo prioridad la atención de casos I y II.',
        )}
      />
      <PriorityLevelCard
        level="IV"
        label={priorityIV.label}
        description={priorityIV.description}
        count={counts.priorityIV}
        color={mapColor(priorityIV.color)}
        tooltipText={t(
          'priorityIVTooltip',
          'Pacientes sin compromiso de funciones vitales ni riesgo de complicación inmediata, que pueden ser atendidos en Consulta Externa o Consultorios Descentralizados.',
        )}
      />
    </div>
  );
}
