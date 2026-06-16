import { useTranslation } from 'react-i18next';

import { type SectionDefinition } from '../../../config-schema';
import { moduleName } from '../../../constants';
import { Field } from '../../field/field.component';
import fieldStyles from '../../field/field.scss';
import styles from './contact-section.scss';

export interface ContactSectionProps {
  sectionDefinition: SectionDefinition;
}

const residenceFieldIds = new Set(['address']);
const birthplaceFieldIds = new Set(['birthAddress']);

/**
 * Renders the "Residencia, nacimiento y contacto" section split into three
 * sub-sections: residencia (the structured address, which carries its own
 * heading), lugar de nacimiento and contacto.
 */
export const ContactSection = ({ sectionDefinition }: ContactSectionProps) => {
  const { t } = useTranslation(moduleName);

  const residenceFields = sectionDefinition.fields.filter((field) => residenceFieldIds.has(field));
  const birthplaceFields = sectionDefinition.fields.filter((field) => birthplaceFieldIds.has(field));
  const contactFields = sectionDefinition.fields.filter(
    (field) => !residenceFieldIds.has(field) && !birthplaceFieldIds.has(field),
  );

  return (
    <section aria-label={`${sectionDefinition.name} Section`}>
      {residenceFields.length > 0 && (
        <div className={styles.subsection}>
          {residenceFields.map((name) => (
            <Field key={`contact-${name}`} name={name} />
          ))}
        </div>
      )}

      {birthplaceFields.length > 0 && (
        <div className={styles.subsection}>
          {birthplaceFields.map((name) => (
            <Field key={`contact-${name}`} name={name} />
          ))}
        </div>
      )}

      {contactFields.length > 0 && (
        <div className={styles.subsection}>
          <h4 className={fieldStyles.productiveHeading02Light}>{t('contactSubsectionHeading', 'Contacto')}</h4>
          <div className={fieldStyles.addressFieldGrid}>
            {contactFields.map((name) => (
              <Field key={`contact-${name}`} name={name} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
};
