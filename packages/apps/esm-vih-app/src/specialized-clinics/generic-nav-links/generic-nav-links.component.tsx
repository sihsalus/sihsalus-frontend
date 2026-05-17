import { Tooltip } from '@carbon/react';
import { ConfigurableLink, MaybeIcon, useConfig } from '@openmrs/esm-framework';
import React from 'react';
import { useTranslation } from 'react-i18next';

import type { ConfigObject } from '../../config-schema';
import styles from './generic-nav-links.scss';

const specialClinicsDashboardPath = 'vih-special-clinics-dashboard';

interface GenericNavLinksProps {
  basePath: string;
}

const GenericNavLinks: React.FC<GenericNavLinksProps> = ({ basePath }) => {
  const { specialClinics } = useConfig<ConfigObject>();
  const { t } = useTranslation();

  return (
    <>
      {specialClinics.map((clinic) => (
        <GenericLink
          key={clinic.id}
          title={clinic.title}
          path={clinic.id}
          basePath={basePath}
          icon={getClinicIcon(clinic.id)}
          tooltip={t(`${clinic.id}Tooltip`, getDefaultTooltip(clinic.id))}
        />
      ))}
    </>
  );
};

export default GenericNavLinks;

const GenericLink: React.FC<{ title: string; path: string; basePath: string; icon: string; tooltip: string }> = ({
  title,
  path,
  basePath,
  icon,
  tooltip,
}) => {
  const link = (
    <ConfigurableLink
      className={`cds--side-nav__link`}
      to={`${basePath}/${encodeURIComponent(specialClinicsDashboardPath)}?clinic=${path}`}
    >
      <span className={styles.menu}>
        <MaybeIcon icon={icon} className={styles.icon} size={16} />
        <span>{title}</span>
      </span>
    </ConfigurableLink>
  );

  return (
    <div className={styles.navItem}>
      <Tooltip
        align="right"
        as="div"
        className={styles.navTooltip}
        label={tooltip}
        enterDelayMs={400}
        leaveDelayMs={100}
      >
        {link}
      </Tooltip>
    </div>
  );
};

function getClinicIcon(clinicId: string) {
  switch (clinicId) {
    case 'psicologia-clinic':
      return 'omrs-icon-user-follow';
    case 'physiotherapy-clinic':
      return 'omrs-icon-movement';
    default:
      return 'omrs-icon-procedure-order';
  }
}

function getDefaultTooltip(clinicId: string) {
  switch (clinicId) {
    case 'psicologia-clinic':
      return 'Registra evaluación, consejería y seguimiento de salud mental dentro de la atención integral.';
    case 'physiotherapy-clinic':
      return 'Registra evaluación funcional, terapia física, rehabilitación y seguimiento del plan terapéutico.';
    default:
      return 'Registra y revisa atenciones especializadas del paciente.';
  }
}
