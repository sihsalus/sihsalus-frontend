import { Tile } from '@carbon/react';
import React from 'react';
import { useTranslation } from 'react-i18next';
import styles from './dashboard.scss';

const Dashboard: React.FC = () => {
  const { t } = useTranslation();

  return (
    <main className={styles.container}>
      <h1>{t('epidemiologicalSurveillance', 'Epidemiological Surveillance')}</h1>
      <Tile>
        <p>
          {t(
            'epidemiologicalSurveillanceDescription',
            'Starter workspace for epidemiological surveillance workflows.',
          )}
        </p>
      </Tile>
    </main>
  );
};

export default Dashboard;
