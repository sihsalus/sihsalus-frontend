import { Tag, Tile } from '@carbon/react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import styles from './cancer-followup.scss';

interface CancerFollowupProps {
  patientUuid: string;
}

/**
 * Widget de seguimiento de prevención del cáncer según guía MINSA.
 * Muestra referencias pendientes, citas de seguimiento y hallazgos.
 */
const CancerFollowup: React.FC<CancerFollowupProps> = ({ patientUuid: _patientUuid }) => {
  const { t } = useTranslation();

  // TODO: Connect to SWR hook when concept UUIDs are configured
  const pendingReferrals = null;
  const lastFollowUpDate = null;
  const nextAppointment = null;
  const abnormalFindings = null;

  return (
    <Tile className={styles.card}>
      <div className={styles.header}>
        <h5>{t('cpFollowUpTitle', 'Seguimiento Oncológico')}</h5>
        <Tag type={abnormalFindings ? 'red' : 'gray'} size="sm">
          {abnormalFindings ? t('cpAbnormal', 'Hallazgo anormal') : t('cpNoFindings', 'Sin hallazgos')}
        </Tag>
      </div>
      <div className={styles.content}>
        <div className={styles.row}>
          <span className={styles.label}>{t('cpPendingReferrals', 'Referencias pendientes')}:</span>
          <span className={styles.value}>{pendingReferrals ?? t('fpNone', 'Ninguno reportado')}</span>
        </div>
        <div className={styles.row}>
          <span className={styles.label}>{t('fpLastVisit', 'Última visita')}:</span>
          <span className={styles.value}>{lastFollowUpDate ?? t('noData', 'Sin datos')}</span>
        </div>
        <div className={styles.row}>
          <span className={styles.label}>{t('fpNextAppointment', 'Próxima cita')}:</span>
          <span className={styles.value}>{nextAppointment ?? t('pending', 'Pending')}</span>
        </div>
      </div>
    </Tile>
  );
};

export default CancerFollowup;
