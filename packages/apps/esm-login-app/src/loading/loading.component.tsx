import { Loading } from '@carbon/react';
import React from 'react';

import styles from './loading.scss';

const LoadingIcon: React.FC = () => (
  <div className={styles['centerLoadingSVG']}>
    <Loading description="Active loading indicator" role="progressbar" withOverlay={false} small />
  </div>
);

export default LoadingIcon;
