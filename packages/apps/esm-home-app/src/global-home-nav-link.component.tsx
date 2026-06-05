import { Home } from '@carbon/react/icons';
import { ConfigurableLink } from '@openmrs/esm-framework';
import React from 'react';
import { useTranslation } from 'react-i18next';

import styles from './global-home-nav-link.scss';

function getSpaBase(): string {
  return globalThis.spaBase ?? globalThis.getOpenmrsSpaBase?.() ?? '/openmrs/spa';
}

const GlobalHomeNavLink: React.FC = () => {
  const { t } = useTranslation();
  const spaBase = getSpaBase();
  const isHomePage = globalThis.location.pathname.startsWith(`${spaBase}/home`);

  if (isHomePage) {
    return null;
  }

  const label = t('returnToHome', 'Volver al inicio');

  return (
    <div className={styles.homeNavSection}>
      <ConfigurableLink to={`${spaBase}/home`} className={styles.homeButton} aria-label={label} title={label}>
        <Home aria-hidden="true" className={styles.homeIcon} size={20} />
        <span className={styles.homeText}>{label}</span>
      </ConfigurableLink>
    </div>
  );
};

export default GlobalHomeNavLink;
