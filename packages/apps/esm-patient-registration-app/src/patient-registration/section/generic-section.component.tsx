import classNames from 'classnames';

import { type SectionDefinition } from '../../config-schema';
import { Field } from '../field/field.component';
import styles from './section.scss';

export interface GenericSectionProps {
  sectionDefinition: SectionDefinition;
}

export const GenericSection = ({ sectionDefinition }: GenericSectionProps) => {
  const isIdentityLookupSection = sectionDefinition.id === 'identityLookup';

  return (
    <section
      className={classNames(styles.formSection, {
        [styles.identityLookupSection]: isIdentityLookupSection,
      })}
      aria-label={`${sectionDefinition.name} Section`}
    >
      {sectionDefinition.fields.map((name) =>
        isIdentityLookupSection ? (
          <div className={styles.sectionField} data-field-name={name} key={`${sectionDefinition.name}-${name}`}>
            <Field name={name} />
          </div>
        ) : (
          <Field key={`${sectionDefinition.name}-${name}`} name={name} />
        ),
      )}
    </section>
  );
};
