import { Tile } from '@carbon/react';
import { useConfig } from '@openmrs/esm-framework';
import classNames from 'classnames';
import { getIn, useFormikContext } from 'formik';
import { useTranslation } from 'react-i18next';

import { type RegistrationConfig, type SectionDefinition } from '../../config-schema';
import { moduleName } from '../../constants';
import { type FormValues } from '../patient-registration.types';
import { getEffectiveRegistrationConfig } from '../peru-registration-config';
import { hasResponsibleRelationship, isMinorPatient } from '../validation/patient-registration-validation';
import { Section } from './section.component';
import styles from './section.scss';

export interface SectionWrapperProps {
  sectionDefinition: SectionDefinition;
  index: number;
}

export const SectionWrapper = ({ sectionDefinition, index }: SectionWrapperProps) => {
  const { t } = useTranslation(moduleName);
  const { errors, touched, values } = useFormikContext<FormValues>();
  const configuredConfig = useConfig<RegistrationConfig>();
  const config = configuredConfig?.sections ? getEffectiveRegistrationConfig(configuredConfig) : configuredConfig;
  const isIdentityLookupSection = sectionDefinition.id === 'identityLookup';
  const isResponsiblePersonSection = sectionDefinition.id === 'responsiblePerson';
  const responsibleRelationshipRequired =
    isResponsiblePersonSection &&
    isMinorPatient(values) &&
    !hasResponsibleRelationship(
      values.relationships,
      config?.relationshipOptions?.minorResponsibleRelationshipTypes ?? [],
    );
  const responsibleRelationshipError =
    responsibleRelationshipRequired && Boolean(getIn(touched, 'relationships') && getIn(errors, 'relationships'));
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
    <div
      aria-invalid={responsibleRelationshipError || undefined}
      className={classNames(styles.sectionAnchor, {
        [styles.sectionRequiresAttention]: responsibleRelationshipRequired && !responsibleRelationshipError,
        [styles.sectionHasError]: responsibleRelationshipError,
      })}
      data-requires-attention={responsibleRelationshipRequired || undefined}
      id={sectionDefinition.id}
    >
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
