import { interpolateUrl, useConfig } from '@openmrs/esm-framework';
import React from 'react';

import { type ConfigSchema } from '../../config-schema';

import styles from './logo.scss';

const Logo: React.FC = () => {
  const { logo } = useConfig<ConfigSchema>();

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    console.error('Failed to load logo image:', e);
  };

  return (
    <>
      {logo?.src ? (
        <img alt={logo.alt} className={styles.logo} onError={handleImageError} src={interpolateUrl(logo.src)} />
      ) : logo?.name ? (
        logo.name
      ) : (
        <span className={styles.logoText}>Sihsalus</span>
      )}
    </>
  );
};

export default Logo;
