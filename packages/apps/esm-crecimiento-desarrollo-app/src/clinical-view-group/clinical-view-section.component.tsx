import { Tooltip } from '@carbon/react';
import { Information as InformationIcon } from '@carbon/react/icons';
import { ExtensionSlot } from '@openmrs/esm-framework';
import { registerNavGroup } from '@openmrs/esm-patient-common-lib';
import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import styles from './clinical-view-section.scss';

interface ClinicalViewSectionProps {
  basePath: string;
}

export const ClinicalViewSection: React.FC<ClinicalViewSectionProps> = ({ basePath }) => {
  const slotName = 'clinical-view-section';
  const { t } = useTranslation();

  useEffect(() => {
    if (slotName) {
      registerNavGroup(slotName);
    }
  }, []);

  return (
    <>
      <div className={styles.container}>
        <span className={styles.span}>{t('clinicalViews', 'Módulos MINSA')}</span>
        <Tooltip
          align="top"
          label={t(
            'customViews',
            'En esta sección encontrará los módulos y programas MINSA disponibles para la atención del paciente.',
          )}
        >
          <button className={styles.tooltipButton} type="button">
            <InformationIcon className={styles.icon} size={20} />
          </button>
        </Tooltip>
      </div>
      <ExtensionSlot style={{ width: '100%', minWidth: '15rem' }} name={slotName} state={{ basePath }} />
    </>
  );
};

export default ClinicalViewSection;
