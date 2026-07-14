import { useContext, useEffect, useMemo } from 'react';

import { type SectionDefinition } from '../../../config-schema';
import { Field } from '../../field/field.component';
import { PatientRegistrationContext } from '../../patient-registration-context';
import {
  peruInsuranceAccreditationActiveConceptUuid,
  peruInsuranceAccreditationCheckedAtAttributeTypeUuid,
  peruInsuranceAccreditationInactiveConceptUuid,
  peruInsuranceAccreditationStatusAttributeTypeUuid,
} from '../../peru-registration-config';
import styles from '../section.scss';

export interface InsuranceSectionProps {
  sectionDefinition: SectionDefinition;
}

const insuranceAccreditationCheckedAtField = 'insuranceAccreditationCheckedAt';
const insuranceAccreditationDateVisibleStatuses = new Set([
  peruInsuranceAccreditationActiveConceptUuid,
  peruInsuranceAccreditationInactiveConceptUuid,
]);

export const InsuranceSection = ({ sectionDefinition }: InsuranceSectionProps) => {
  const registrationContext = useContext(PatientRegistrationContext);
  const accreditationStatus =
    registrationContext?.values?.attributes?.[peruInsuranceAccreditationStatusAttributeTypeUuid];
  const shouldShowAccreditationDate = insuranceAccreditationDateVisibleStatuses.has(accreditationStatus ?? '');
  const accreditationCheckedAt =
    registrationContext?.values?.attributes?.[peruInsuranceAccreditationCheckedAtAttributeTypeUuid];

  useEffect(() => {
    if (!shouldShowAccreditationDate && accreditationCheckedAt) {
      registrationContext?.setFieldValue(
        `attributes.${peruInsuranceAccreditationCheckedAtAttributeTypeUuid}`,
        '',
        false,
      );
    }
  }, [accreditationCheckedAt, registrationContext, shouldShowAccreditationDate]);

  const visibleFields = useMemo(
    () =>
      sectionDefinition.fields.filter(
        (name) => name !== insuranceAccreditationCheckedAtField || shouldShowAccreditationDate,
      ),
    [sectionDefinition.fields, shouldShowAccreditationDate],
  );

  return (
    <section className={styles.formSection} aria-label={`${sectionDefinition.name} Section`}>
      {visibleFields.map((name) => (
        <Field key={`${sectionDefinition.name}-${name}`} name={name} />
      ))}
    </section>
  );
};
