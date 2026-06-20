import { ClickableTile, Layer } from '@carbon/react';
import { ArrowRight } from '@carbon/react/icons';
import React from 'react';
import { useTranslation } from 'react-i18next';

import styles from './openmrs-livekit-admin-card-link.scss';

const OpenmrsLivekitAdminCardLink: React.FC = () => {
  const { t } = useTranslation();

  return (
    <Layer>
      <a className={styles.cardLink} href={`${globalThis.getOpenmrsSpaBase()}openmrs-livekit`}>
        <ClickableTile>
          <div>
            <div className="heading">{t('openmrsLivekit', 'OpenMRS LiveKit')}</div>
            <div className="content">{t('openmrsLivekitAdminDescription', 'AI translation and encounter review')}</div>
          </div>
          <div className="iconWrapper">
            <ArrowRight size={16} />
          </div>
        </ClickableTile>
      </a>
    </Layer>
  );
};

export default OpenmrsLivekitAdminCardLink;
