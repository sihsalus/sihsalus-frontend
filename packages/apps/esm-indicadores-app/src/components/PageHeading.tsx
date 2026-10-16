import { Assessment2Pictogram } from '@openmrs/esm-framework';
import React from 'react';

import styles from '../indicators-dashboard.module.scss';

interface PageHeadingProps {
  title: string;
  subtitle?: string;
}

/**
 * Section heading with the module pictogram, mirroring the OpenMRS page header
 * used by other apps. Keeps the title as an `h1` plus the subtitle (the stock
 * `PageHeader` renders a plain label and no subtitle).
 */
const PageHeading: React.FC<PageHeadingProps> = ({ title, subtitle }) => (
  <div className={styles.pageHeading}>
    <Assessment2Pictogram className={styles.pagePictogram} />
    <div>
      <h1>{title}</h1>
      {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}
    </div>
  </div>
);

export default PageHeading;
