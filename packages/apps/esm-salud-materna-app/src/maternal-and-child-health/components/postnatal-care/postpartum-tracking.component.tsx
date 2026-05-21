import { Tag, Tile } from '@carbon/react';
import { CheckmarkFilled, Time } from '@carbon/react/icons';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { usePostpartumControlTable } from '../../../hooks/usePostpartumControl';

import styles from './postpartum-tracking.scss';

interface PostpartumTrackingProps {
  patientUuid: string;
}

/**
 * Tracking de controles de puerperio según NTS 105-MINSA:
 * - Control 1: dentro de los 7 días postparto
 * - Control 2: a los 30 días postparto
 * - "Puérpera controlada" = ambos controles + hemoglobina + sulfato ferroso a los 30d
 */
const PostpartumTracking: React.FC<PostpartumTrackingProps> = ({ patientUuid }) => {
  const { t } = useTranslation();
  const { prenatalEncounters } = usePostpartumControlTable(patientUuid);

  const trackingStatus = useMemo(() => {
    const totalControls = prenatalEncounters?.length ?? 0;
    const control7d = totalControls >= 1;
    const control30d = totalControls >= 2;
    const isControlled = control7d && control30d;

    return { totalControls, control7d, control30d, isControlled };
  }, [prenatalEncounters]);

  const renderIndicator = (completed: boolean, label: string) => (
    <div className={styles.indicator}>
      {completed ? (
        <CheckmarkFilled size={20} className={styles.iconSuccess} />
      ) : (
        <Time size={20} className={styles.iconPending} />
      )}
      <span className={completed ? styles.completed : styles.pending}>{label}</span>
    </div>
  );

  return (
    <Tile className={styles.trackingCard}>
      <div className={styles.header}>
        <h5>{t('postpartumTracking', 'Seguimiento Puerperio (NTS 105)')}</h5>
        {trackingStatus.isControlled ? (
          <Tag type="green" size="sm">
            {t('controlledPuerpera', 'Puérpera Controlada')}
          </Tag>
        ) : (
          <Tag type="gray" size="sm">
            {t('pendingControls', 'Controles Pendientes')}
          </Tag>
        )}
      </div>
      <div className={styles.indicators}>
        {renderIndicator(trackingStatus.control7d, t('control7d', 'Control 7 días postparto'))}
        {renderIndicator(trackingStatus.control30d, t('control30d', 'Control 30 días postparto'))}
      </div>
      <div className={styles.summary}>
        <span className={styles.count}>
          {trackingStatus.totalControls}/2 {t('controlsCompleted', 'controles completados')}
        </span>
      </div>
    </Tile>
  );
};

export default PostpartumTracking;
