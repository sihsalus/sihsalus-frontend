import { ClickableTile } from '@carbon/react';
import { ChartLineData } from '@carbon/react/icons';
import React from 'react';
import { useTranslation } from 'react-i18next';

import styles from './app-menu-item.scss';

const IndicadoresAppMenuItem: React.FC = () => {
  const { t } = useTranslation();
  const openmrsSpaBase = window['getOpenmrsSpaBase']();

  return (
    <ClickableTile className={styles.tile} href={`${openmrsSpaBase}indicators`}>
      <ChartLineData size={32} className={styles.icon} />
      <span className={styles.label}>{t('indicatorsAppMenuLink', 'Indicadores')}</span>
    </ClickableTile>
  );
};

export default IndicadoresAppMenuItem;
