import { Link, Tile } from '@carbon/react';
import { ArrowRightIcon, interpolateUrl, useConfig } from '@openmrs/esm-framework';
import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { type ConfigSchema } from './config-schema';
import styles from './footer.scss';

interface Logo {
  src: string;
  alt?: string;
}

const Footer: React.FC = () => {
  const { t } = useTranslation();
  const config = useConfig<ConfigSchema>();
  const logos: Logo[] = config.footer.additionalLogos || [];

  const handleImageLoadError = useCallback((error: React.SyntheticEvent<HTMLImageElement, Event>) => {
    console.error('Failed to load image', error);
  }, []);

  return (
    <div className={styles.footer}>
      <Tile className={styles.poweredByTile}>
        <div className={styles.poweredByContainer}>
          <span className={styles.poweredByText}>{t('builtWith', 'Built with')}</span>
          {config.logo.src ? (
            <img
              alt={config.logo.alt || t('sihsalusLogo', 'Sihsalus logo')}
              className={styles.poweredByLogo}
              onError={handleImageLoadError}
              src={interpolateUrl(config.logo.src)}
            />
          ) : (
            <span className={styles.poweredByText}>{t('sihsalusLogo', 'Sihsalus')}</span>
          )}
          <span className={`${styles.poweredByText} ${styles.poweredBySubtext}`}>
            {t('poweredBySubtext', 'Historia clínica digital para la red Sihsalus')}
          </span>
          <Link
            className={styles.learnMoreButton}
            href="https://inform.pucp.edu.pe/santaclotilde/"
            rel="noopener noreferrer"
            renderIcon={() => <ArrowRightIcon size={16} aria-label="Arrow right icon" />}
            target="_blank"
          >
            {t('learnMore', 'Learn more')}
          </Link>
        </div>
      </Tile>

      <div className={styles.logosContainer}>
        {logos.map((logo) => (
          <img
            alt={logo.alt || t('footerlogo', 'Footer Logo')}
            className={styles.poweredByLogo}
            key={logo.src}
            onError={handleImageLoadError}
            src={logo.src}
          />
        ))}
      </div>
    </div>
  );
};

export default Footer;
