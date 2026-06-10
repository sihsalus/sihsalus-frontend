import { Tile } from '@carbon/react';
import { useTranslation } from 'react-i18next';

import { type SectionDefinition } from '../../config-schema';
import { moduleName } from '../../constants';
import { Section } from './section.component';
import styles from './section.scss';

export interface SectionWrapperProps {
  sectionDefinition: SectionDefinition;
  index: number;
}

export const SectionWrapper = ({ sectionDefinition, index }: SectionWrapperProps) => {
  const { t } = useTranslation(moduleName);

  /*
   * This comment exists to provide translation keys for the default section names.
   *
   * DO NOT REMOVE THESE UNLESS A DEFAULT SECTION IS REMOVED
   * t('demographicsSection', 'Basic Info')
   * t('contactSection', 'Residence, birthplace and contact')
   * t('deathSection', 'Death Info')
   * t('relationshipsSection', 'Relationships')
   */
  return (
    <div className={styles.sectionAnchor} id={sectionDefinition.id}>
      <h3 className={styles.productiveHeading02}>
        {index + 1}. {t(`${sectionDefinition.id}Section`, sectionDefinition.name)}
      </h3>
      <span className={styles.label01}>
        {t('allFieldsRequiredText', 'All fields are required unless marked optional')}
      </span>
      <div className={styles.sectionCard}>
        <Tile className={styles.sectionTile}>
          <Section sectionDefinition={sectionDefinition} />
        </Tile>
      </div>
    </div>
  );
};
