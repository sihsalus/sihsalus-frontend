import { Layer, Tile } from '@carbon/react';
import { Information } from '@carbon/react/icons';
import React from 'react';
import { useTranslation } from 'react-i18next';

import styles from './slot-placeholder.scss';

interface SlotPlaceholderProps {
  titleKey?: string;
  descriptionKey?: string;
}

const SlotPlaceholder: React.FC<SlotPlaceholderProps> = ({
  titleKey = 'slotComingSoon',
  descriptionKey = 'slotComingSoonDescription',
}) => {
  const { t } = useTranslation('@sihsalus/esm-cred-app');

  return (
    <Layer>
      <Tile className={styles.placeholder}>
        <Information size={32} className={styles.icon} />
        <h5 className={styles.title}>{t(titleKey)}</h5>
        <p className={styles.description}>{t(descriptionKey)}</p>
      </Tile>
    </Layer>
  );
};

export default SlotPlaceholder;
