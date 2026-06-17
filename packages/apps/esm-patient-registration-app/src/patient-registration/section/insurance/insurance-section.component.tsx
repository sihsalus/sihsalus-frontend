import { type SectionDefinition } from '../../../config-schema';
import { Field } from '../../field/field.component';
import { CopyResponsibleDataButton } from '../copy-responsible-data/copy-responsible-data-button.component';
import styles from '../section.scss';

export interface InsuranceSectionProps {
  sectionDefinition: SectionDefinition;
}

export const InsuranceSection = ({ sectionDefinition }: InsuranceSectionProps) => {
  return (
    <section className={styles.formSection} aria-label={`${sectionDefinition.name} Section`}>
      <CopyResponsibleDataButton mode="insurance" />
      {sectionDefinition.fields.map((name) => (
        <Field key={`${sectionDefinition.name}-${name}`} name={name} />
      ))}
    </section>
  );
};
