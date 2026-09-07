import { Launch } from '@carbon/react/icons';
import { useConfig, useConnectivity } from '@openmrs/esm-framework';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { type HomeConfig } from '../config-schema';
import styles from './reference-links.scss';

/**
 * Third-party reference sites, kept deliberately out of the action grid above.
 * Those cards navigate inside SIH Salus; a clinician has to be able to tell at
 * a glance when a click leaves the record system, so these are rendered as
 * plain external links with their own heading and a launch affordance.
 *
 * The section hides itself while the browser is offline. On the river posts
 * that is the normal state, and a wall of links that cannot resolve is worse
 * than no links at all.
 */
const ReferenceLinks: React.FC = () => {
  const { t } = useTranslation();
  const { clinicalReferenceLinks } = useConfig<HomeConfig>();
  const isOnline = useConnectivity();

  if (!isOnline || !clinicalReferenceLinks?.length) {
    return null;
  }

  return (
    <section className={styles.referenceLinks} aria-labelledby="sihsalus-reference-links-heading">
      <h2 className={styles.heading} id="sihsalus-reference-links-heading">
        {t('clinicalReferenceLinks', 'Enlaces de referencia')}
      </h2>
      <p className={styles.caption}>
        {t('clinicalReferenceLinksCaption', 'Servicios externos a SIH Salus. Se abren en una pestaña nueva.')}
      </p>
      <ul className={styles.linkList}>
        {clinicalReferenceLinks.map(({ description, label, url }) => (
          <li className={styles.linkItem} key={url}>
            {/* noreferrer keeps the SIH Salus URL, which carries the patient
                UUID on some routes, out of the third party's referer log. */}
            <a className={styles.link} href={url} rel="noopener noreferrer external" target="_blank">
              <span className={styles.linkText}>
                <strong className={styles.linkLabel}>{label}</strong>
                {description ? <span className={styles.linkDescription}>{description}</span> : null}
              </span>
              <Launch aria-hidden="true" className={styles.linkIcon} size={16} />
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
};

export default ReferenceLinks;
