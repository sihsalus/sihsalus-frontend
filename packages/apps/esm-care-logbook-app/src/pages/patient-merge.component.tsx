import { Button, InlineNotification } from '@carbon/react';
import { Launch } from '@carbon/react/icons';
import { navigate } from '@openmrs/esm-framework';
import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { moduleName } from '../constants';
import styles from './patient-merge.scss';

const legacyPatientMergePath = '/admin/patients/findDuplicatePatients.htm';

export function getLegacyPatientMergeUrl(openmrsBase = globalThis.openmrsBase ?? '/openmrs') {
  return `${openmrsBase.replace(/\/$/, '')}${legacyPatientMergePath}`;
}

export default function PatientMerge() {
  const { t } = useTranslation(moduleName);
  const legacyPatientMergeUrl = useMemo(() => getLegacyPatientMergeUrl(), []);

  useEffect(() => {
    navigate({ to: legacyPatientMergeUrl });
  }, [legacyPatientMergeUrl]);

  return (
    <main className={styles.container}>
      <section className={styles.panel}>
        <p className={styles.eyebrow}>{t('patientMergeWorkflow', 'Libro de Atenciones')}</p>
        <h1>{t('mergeDuplicatePatientRecords', 'Fusionar historias clínicas duplicadas')}</h1>
        <p>
          {t(
            'mergeDuplicatePatientRecordsSummary',
            'Use esta opción cuando dos historias clínicas pertenezcan al mismo paciente y una deba conservarse como historia preferida.',
          )}
        </p>
        <InlineNotification
          kind="info"
          lowContrast
          title={t('openingLegacyMergePatients', 'Abriendo el flujo legacy de OpenMRS')}
          subtitle={t(
            'openingLegacyMergePatientsHint',
            'La fusión real de pacientes se realiza fuera del shell SPA para usar la pantalla administrativa de OpenMRS.',
          )}
        />
        <Button href={legacyPatientMergeUrl} renderIcon={Launch}>
          {t('openLegacyMergePatients', 'Abrir fusión de pacientes')}
        </Button>
      </section>
    </main>
  );
}
