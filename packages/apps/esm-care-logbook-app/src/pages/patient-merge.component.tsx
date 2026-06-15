import { Button } from '@carbon/react';
import { Launch } from '@carbon/react/icons';
import { useTranslation } from 'react-i18next';

import { moduleName } from '../constants';
import styles from './patient-merge.scss';

const legacyMergeUrl = `${globalThis.openmrsBase}/admin/patients/mergePatients.form`;

export default function PatientMerge() {
  const { t } = useTranslation(moduleName);

  return (
    <main className={styles.container}>
      <div className={styles.header}>
        <h1>{t('mergeDuplicatePatientRecords', 'Fusionar historias clínicas duplicadas')}</h1>
        <Button kind="primary" renderIcon={Launch} href={legacyMergeUrl}>
          {t('openLegacyMergePatients', 'Abrir fusión de pacientes')}
        </Button>
      </div>
      <p className={styles.summary}>
        {t(
          'mergeDuplicatePatientRecordsSummary',
          'Use esta opción cuando dos historias clínicas pertenezcan al mismo paciente y una deba conservarse como historia preferida.',
        )}
      </p>
    </main>
  );
}
