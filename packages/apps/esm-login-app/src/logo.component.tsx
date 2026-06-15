import { interpolateUrl, useConfig } from '@openmrs/esm-framework';
import { type TFunction } from 'i18next';
import React from 'react';

import { type ConfigSchema } from './config-schema';
import styles from './login/login.module.scss';

const Logo: React.FC<{ t: TFunction }> = ({ t }) => {
  const { logo } = useConfig<ConfigSchema>();
  return logo.src ? (
    <img
      alt={logo.alt || t('sihsalusLogo', 'Sihsalus logo')}
      className={styles.logoImg}
      src={interpolateUrl(logo.src)}
    />
  ) : (
    <span className={styles.logoText}>{t('sihsalusLogo', 'Sihsalus')}</span>
  );
};

export default Logo;
