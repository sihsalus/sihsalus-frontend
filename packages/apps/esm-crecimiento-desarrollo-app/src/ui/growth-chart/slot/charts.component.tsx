import { Extension, ExtensionSlot } from '@openmrs/esm-framework';
import React from 'react';

import styles from './charts.scss';

export const Charts: React.FC = () => {
  return (
    <div className={styles.container}>
      <ExtensionSlot name="Charts" className={styles.charts}>
        <div className={styles.chart}>
          <Extension />
        </div>
      </ExtensionSlot>
    </div>
  );
};
