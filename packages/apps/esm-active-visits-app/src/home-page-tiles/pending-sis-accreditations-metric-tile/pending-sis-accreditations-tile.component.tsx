import { ClickableTile } from '@carbon/react';
import { useConfig } from '@openmrs/esm-framework';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { type ActiveVisitsConfigSchema } from '../../config-schema';
import { usePendingSisAccreditations } from '../../pending-sis-accreditations/pending-sis-accreditations.resource';
import styles from '../homepage-tiles.scss';

const PendingSisAccreditationsTile = () => {
  const { t } = useTranslation();
  const config = useConfig<ActiveVisitsConfigSchema>();
  const { pendingVisits, error, isLoading } = usePendingSisAccreditations(config.pendingSisAccreditations);
  const pendingPatients = useMemo(
    () => new Set(pendingVisits.map((visit) => visit.patientUuid || `visit:${visit.visitUuid}`)).size,
    [pendingVisits],
  );
  const spaBase = (globalThis.spaBase ?? globalThis.getOpenmrsSpaBase()).replace(/\/$/, '');

  return (
    <ClickableTile className={styles.tileContainer} href={`${spaBase}/home/home#pending-sis-accreditations`}>
      <header className={styles.tileHeader}>
        {t('patientsPendingSisAccreditation', 'Pacientes pendientes de acreditación')}
      </header>
      <div className={styles.displayDetails}>
        <div className={styles.countLabel}>{t('patients', 'Pacientes')}</div>
        <div className={styles.displayData}>{isLoading || error ? '--' : pendingPatients}</div>
      </div>
    </ClickableTile>
  );
};

export default PendingSisAccreditationsTile;
