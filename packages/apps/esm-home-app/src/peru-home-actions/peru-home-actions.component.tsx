import { ConfigurableLink } from '@openmrs/esm-framework';
import React from 'react';
import { useTranslation } from 'react-i18next';

import appointmentsIllustration from '../../../../../assets/resources/illustrations/citas.svg';
import careQueuesIllustration from '../../../../../assets/resources/illustrations/colas-de-atencion.svg';
import fuaIllustration from '../../../../../assets/resources/illustrations/fua-seguro-sis.svg';
import laboratoryIllustration from '../../../../../assets/resources/illustrations/laboratorio.svg';
import patientRegistrationIllustration from '../../../../../assets/resources/illustrations/registrar-paciente.svg';
import patientSearchIllustration from '../../../../../assets/resources/illustrations/buscar-paciente.svg';
import styles from './peru-home-actions.scss';

type Action = {
  key: string;
  descriptionKey: string;
  href: string;
  illustrationSrc: string;
  toneClass: string;
};

// t('searchPatient', 'Search patient')
// t('searchPatientDescription', 'Find an existing patient record')
// t('registerPatient', 'Register patient')
// t('registerPatientDescription', 'Create a new patient record')
// t('careQueues', 'Care queues')
// t('careQueuesDescription', 'Manage patient service queues')
// t('appointments', 'Appointments')
// t('appointmentsDescription', 'View and manage appointments')
// t('laboratory', 'Laboratory')
// t('laboratoryDescription', 'Review lab orders and results')
// t('fua', 'FUA')
// t('fuaDescription', 'Manage Formato Unico de Atencion')
const actions = [
  {
    key: 'searchPatient',
    descriptionKey: 'searchPatientDescription',
    href: '/search',
    illustrationSrc: patientSearchIllustration,
    toneClass: 'admissionAction',
  },
  {
    key: 'registerPatient',
    descriptionKey: 'registerPatientDescription',
    href: '/patient-registration',
    illustrationSrc: patientRegistrationIllustration,
    toneClass: 'admissionAction',
  },
  {
    key: 'careQueues',
    descriptionKey: 'careQueuesDescription',
    href: '/home/service-queues',
    illustrationSrc: careQueuesIllustration,
    toneClass: 'admissionAction',
  },
  {
    key: 'appointments',
    descriptionKey: 'appointmentsDescription',
    href: '/home/appointments',
    illustrationSrc: appointmentsIllustration,
    toneClass: 'appointmentsAction',
  },
  {
    key: 'laboratory',
    descriptionKey: 'laboratoryDescription',
    href: '/home/laboratory',
    illustrationSrc: laboratoryIllustration,
    toneClass: 'laboratoryAction',
  },
  {
    key: 'fua',
    descriptionKey: 'fuaDescription',
    href: '/home/fua-request',
    illustrationSrc: fuaIllustration,
    toneClass: 'fuaAction',
  },
] satisfies Array<Action>;

const ActionIllustration: React.FC<{ illustrationSrc: string }> = ({ illustrationSrc }) => (
  <img className={styles.actionIllustration} src={illustrationSrc} alt="" loading="lazy" />
);

const PeruHomeActions: React.FC = () => {
  const { t } = useTranslation();
  const spaBase = globalThis.spaBase ?? globalThis.getOpenmrsSpaBase?.() ?? '/openmrs/spa';

  return (
    <section className={styles.quickActions} aria-label={t('peruHomeActions', 'Accesos de admisión')}>
      {actions.map(({ key, descriptionKey, href, illustrationSrc, toneClass }) => (
        <ConfigurableLink key={key} className={`${styles.actionLink} ${styles[toneClass]}`} to={`${spaBase}${href}`}>
          <span className={styles.actionHeader}>
            <span className={styles.actionText}>
              <strong>{t(key)}</strong>
              <span>{t(descriptionKey)}</span>
            </span>
          </span>
          <span className={styles.illustrationArea} aria-hidden="true">
            <ActionIllustration illustrationSrc={illustrationSrc} />
          </span>
        </ConfigurableLink>
      ))}
    </section>
  );
};

export default PeruHomeActions;
