import { ConfigurableLink } from '@openmrs/esm-framework';
import { RequirePrivilege } from '@sihsalus/esm-rbac';
import React from 'react';
import { useTranslation } from 'react-i18next';
import patientSearchIllustration from '../../../../../assets/resources/illustrations/buscar-paciente.svg';
import appointmentsIllustration from '../../../../../assets/resources/illustrations/citas.svg';
import careQueuesIllustration from '../../../../../assets/resources/illustrations/colas-de-atencion.svg';
import dispensingIllustration from '../../../../../assets/resources/illustrations/farmacia.svg';
import fuaIllustration from '../../../../../assets/resources/illustrations/fua-seguro-sis.svg';
import laboratoryIllustration from '../../../../../assets/resources/illustrations/laboratorio.svg';
import patientRegistrationIllustration from '../../../../../assets/resources/illustrations/registrar-paciente.svg';
import styles from './peru-home-actions.scss';

type Action = {
  key: string;
  descriptionKey: string;
  href: string;
  illustrationSrc: string;
  privilege: string | string[];
  toneClass: string;
};

const admissionPrivilege = 'app:adt';
const patientSearchPrivilege = 'Get Patients';
const appointmentsPrivilege = 'app:appointments';
const serviceQueuesPrivilege = 'app:service-queues';
const laboratoryPrivilege = 'app:laboratory';
const dispensingPrivilege = 'app:dispensing';
const fuaReadPrivilege = 'app:fua';

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
// t('dispensing', 'Dispensing')
// t('dispensingDescription', 'Dispense prescribed medications')
// t('fua', 'FUA')
// t('fuaDescription', 'Manage Formato Unico de Atencion')
const actions = [
  {
    key: 'searchPatient',
    descriptionKey: 'searchPatientDescription',
    href: '/search',
    illustrationSrc: patientSearchIllustration,
    privilege: patientSearchPrivilege,
    toneClass: 'admissionAction',
  },
  {
    key: 'registerPatient',
    descriptionKey: 'registerPatientDescription',
    href: '/patient-registration',
    illustrationSrc: patientRegistrationIllustration,
    privilege: admissionPrivilege,
    toneClass: 'admissionAction',
  },
  {
    key: 'careQueues',
    descriptionKey: 'careQueuesDescription',
    href: '/home/service-queues',
    illustrationSrc: careQueuesIllustration,
    privilege: serviceQueuesPrivilege,
    toneClass: 'admissionAction',
  },
  {
    key: 'appointments',
    descriptionKey: 'appointmentsDescription',
    href: '/home/appointments',
    illustrationSrc: appointmentsIllustration,
    privilege: appointmentsPrivilege,
    toneClass: 'appointmentsAction',
  },
  {
    key: 'laboratory',
    descriptionKey: 'laboratoryDescription',
    href: '/home/laboratory',
    illustrationSrc: laboratoryIllustration,
    privilege: laboratoryPrivilege,
    toneClass: 'laboratoryAction',
  },
  {
    key: 'dispensing',
    descriptionKey: 'dispensingDescription',
    href: '/dispensing',
    illustrationSrc: dispensingIllustration,
    privilege: dispensingPrivilege,
    toneClass: 'dispensingAction',
  },
  {
    key: 'fua',
    descriptionKey: 'fuaDescription',
    href: '/home/fua-request',
    illustrationSrc: fuaIllustration,
    privilege: fuaReadPrivilege,
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
      {actions.map(({ key, descriptionKey, href, illustrationSrc, privilege, toneClass }) => (
        <RequirePrivilege key={key} privilege={privilege} hideUnauthorized>
          <ConfigurableLink className={`${styles.actionLink} ${styles[toneClass]}`} to={`${spaBase}${href}`}>
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
        </RequirePrivilege>
      ))}
    </section>
  );
};

export default PeruHomeActions;
