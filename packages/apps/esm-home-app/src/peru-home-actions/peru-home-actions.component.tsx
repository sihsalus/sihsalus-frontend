import {
  Calendar,
  Document,
  Microscope,
  Search,
  UserFollow,
  WatsonHealthStackedScrolling_1,
} from '@carbon/react/icons';
import { ConfigurableLink } from '@openmrs/esm-framework';
import React from 'react';
import { useTranslation } from 'react-i18next';

import styles from './peru-home-actions.scss';

type ActionIcon = React.ComponentType<{ className?: string; size?: number | string }>;

type Action = {
  key: string;
  descriptionKey: string;
  href: string;
  icon: ActionIcon;
  illustrationId?: string;
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
    icon: Search,
    illustrationId: 'omrs-pict-patient-search',
    toneClass: 'admissionAction',
  },
  {
    key: 'registerPatient',
    descriptionKey: 'registerPatientDescription',
    href: '/patient-registration',
    icon: UserFollow,
    illustrationId: 'omrs-pict-registration',
    toneClass: 'admissionAction',
  },
  {
    key: 'careQueues',
    descriptionKey: 'careQueuesDescription',
    href: '/home/service-queues',
    icon: WatsonHealthStackedScrolling_1,
    illustrationId: 'omrs-pict-service-queues',
    toneClass: 'admissionAction',
  },
  {
    key: 'appointments',
    descriptionKey: 'appointmentsDescription',
    href: '/home/appointments',
    icon: Calendar,
    illustrationId: 'omrs-pict-appointments',
    toneClass: 'appointmentsAction',
  },
  {
    key: 'laboratory',
    descriptionKey: 'laboratoryDescription',
    href: '/home/laboratory',
    icon: Microscope,
    illustrationId: 'omrs-pict-laboratory',
    toneClass: 'laboratoryAction',
  },
  {
    key: 'fua',
    descriptionKey: 'fuaDescription',
    href: '/home/fua-request',
    icon: Document,
    illustrationId: 'omrs-pict-fua',
    toneClass: 'fuaAction',
  },
] satisfies Array<Action>;

const ActionIllustration: React.FC<{ illustrationId?: string }> = ({ illustrationId }) => {
  return (
    <svg
      className={styles.actionIllustration}
      viewBox="0 0 80 80"
      preserveAspectRatio="xMidYMid meet"
      focusable="false"
      aria-hidden="true"
    >
      <use href={`#${illustrationId}`} />
    </svg>
  );
};

const PeruHomeActions: React.FC = () => {
  const { t } = useTranslation();
  const spaBase = globalThis.spaBase ?? globalThis.getOpenmrsSpaBase?.() ?? '/openmrs/spa';

  return (
    <section className={styles.quickActions} aria-label={t('peruHomeActions', 'Accesos de admisión')}>
      {actions.map(({ key, descriptionKey, href, illustrationId, toneClass }) => (
        <ConfigurableLink key={key} className={`${styles.actionLink} ${styles[toneClass]}`} to={`${spaBase}${href}`}>
          <span className={styles.actionHeader}>
            <span className={styles.actionText}>
              <strong>{t(key)}</strong>
              <span>{t(descriptionKey)}</span>
            </span>
          </span>
          <span className={styles.illustrationArea} aria-hidden="true">
            <ActionIllustration illustrationId={illustrationId} />
          </span>
        </ConfigurableLink>
      ))}
    </section>
  );
};

export default PeruHomeActions;
