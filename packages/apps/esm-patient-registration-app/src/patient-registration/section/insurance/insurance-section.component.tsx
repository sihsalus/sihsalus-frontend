import { useContext, useEffect, useMemo } from 'react';

import { type SectionDefinition } from '../../../config-schema';
import { Field } from '../../field/field.component';
import { PatientRegistrationContext } from '../../patient-registration-context';
import {
  peruInsuranceAccreditationActiveConceptUuid,
  peruInsuranceAccreditationCheckedAtAttributeTypeUuid,
  peruInsuranceAccreditationInactiveConceptUuid,
  peruInsuranceAccreditationPendingConceptUuid,
  peruInsuranceAccreditationStatusAttributeTypeUuid,
} from '../../peru-registration-config';
import styles from '../section.scss';

export interface InsuranceSectionProps {
  sectionDefinition: SectionDefinition;
}

const insuranceAccreditationCheckedAtField = 'insuranceAccreditationCheckedAt';
/**
 * Estados en los que la fecha de verificación tiene sentido. «Pendiente» también
 * la conserva: es el valor que toma la verificación sin conexión, y saber *cuándo*
 * Admisión lo intentó es justamente lo que permite retomarlo después. Solo «No
 * consultada» (nunca se intentó) la descarta.
 */
const insuranceAccreditationDateVisibleStatuses = new Set([
  peruInsuranceAccreditationActiveConceptUuid,
  peruInsuranceAccreditationInactiveConceptUuid,
  peruInsuranceAccreditationPendingConceptUuid,
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
