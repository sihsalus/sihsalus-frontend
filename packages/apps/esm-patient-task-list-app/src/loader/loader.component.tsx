import { InlineLoading } from '@carbon/react';
import { getCoreTranslation } from '@openmrs/esm-framework';
import React from 'react';
import styles from './loader.scss';

const Loader: React.FC = () => {
  return <InlineLoading className={styles.loading} description={`${getCoreTranslation('loading')} ...`} />;
};

export default Loader;
