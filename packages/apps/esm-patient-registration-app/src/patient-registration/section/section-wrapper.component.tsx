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
  const isIdentityLookupSection = sectionDefinition.id === 'identityLookup';
  const sectionNumber = isIdentityLookupSection ? 0 : index;
  const helperText = isIdentityLookupSection
    ? t(
        'identityLookupSectionHelpText',
        'Ingrese el DNI del paciente y consulte RENIEC/SIS antes de completar los datos.',
      )
    : t('allFieldsRequiredText', 'All fields are required unless marked optional');

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
        {sectionNumber}. {t(`${sectionDefinition.id}Section`, sectionDefinition.name)}
      </h3>
      <span className={styles.label01}>{helperText}</span>
      <div className={styles.sectionCard}>
        <Tile className={styles.sectionTile}>
          <Section sectionDefinition={sectionDefinition} />
        </Tile>
      </div>
    </div>
  );
};
