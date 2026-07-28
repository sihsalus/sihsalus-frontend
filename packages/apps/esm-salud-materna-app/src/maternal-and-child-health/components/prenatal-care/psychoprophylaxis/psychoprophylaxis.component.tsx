import { ProgressBar, Tag, Tile } from '@carbon/react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { usePsychoprophylaxis } from '../../../../hooks/use-psychoprophylaxis';

import styles from './psychoprophylaxis.scss';

interface PsychoprophylaxisProps {
  patientUuid: string;
}

/**
 * Widget de psicoprofilaxis obstétrica según NTS 105-MINSA.
 * 6 sesiones obligatorias a partir de la semana 20 de gestación.
 */
const Psychoprophylaxis: React.FC<PsychoprophylaxisProps> = ({ patientUuid }) => {
  const { t } = useTranslation();
  const { sessionsCompleted, totalSessions, percentage, isComplete, lastSessionDate, isLoading, error } =
    usePsychoprophylaxis(patientUuid);

  if (isLoading) return <Tile className={styles.card}>{t('loading', 'Loading...')}</Tile>;

  return (
    <Tile className={styles.card}>
      <div className={styles.header}>
        <h5>{t('psychoprophylaxis', 'Psicoprofilaxis Obstétrica')}</h5>
        <Tag type={isComplete ? 'green' : 'blue'} size="sm">
          {isComplete ? t('complete', 'Completo') : `${sessionsCompleted}/${totalSessions}`}
        </Tag>
      </div>
      <div className={styles.content}>
        <ProgressBar
          label={`${sessionsCompleted}/${totalSessions} ${t('sessions', 'sesiones')}`}
          value={percentage}
          size="small"
          status={isComplete ? 'finished' : 'active'}
        />
        {lastSessionDate && (
          <div className={styles.row}>
            <span className={styles.label}>{t('lastSession', 'Última sesión')}:</span>
            <span className={styles.value}>{lastSessionDate}</span>
          </div>
        )}
      </div>
      {error && <p className={styles.error}>{t('errorLoading', 'Error al cargar datos')}</p>}
    </Tile>
  );
};

export default Psychoprophylaxis;
