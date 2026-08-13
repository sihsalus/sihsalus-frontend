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
  peruFinancerDependentAttributeTypeUuids,
  peruInsuranceSelfFinancingConceptUuid,
  peruInsuranceSisConceptUuid,
  peruInsuranceTypeAttributeTypeUuid,
  peruLegacySisPlanConceptUuid,
  shouldPersistPeruInsuranceAttribute,
} from '../../peru-registration-config';
import styles from '../section.scss';

export interface InsuranceSectionProps {
  sectionDefinition: SectionDefinition;
}

const insuranceAccreditationCheckedAtField = 'insuranceAccreditationCheckedAt';
const insuranceAccreditationStatusField = 'insuranceAccreditationStatus';
const insuranceCodeField = 'insuranceCode';
const sisLookupField = 'sisLookup';
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
  const attributes = registrationContext?.values?.attributes;
  const insuranceType = attributes?.[peruInsuranceTypeAttributeTypeUuid];
  const isSisFinancer = insuranceType === peruInsuranceSisConceptUuid || insuranceType === peruLegacySisPlanConceptUuid;
  const isSelfFinancing = insuranceType === peruInsuranceSelfFinancingConceptUuid;
  const accreditationStatus = attributes?.[peruInsuranceAccreditationStatusAttributeTypeUuid];
  const shouldShowAccreditationDate =
    isSisFinancer && insuranceAccreditationDateVisibleStatuses.has(accreditationStatus ?? '');
  const accreditationCheckedAt = attributes?.[peruInsuranceAccreditationCheckedAtAttributeTypeUuid];

  useEffect(() => {
    const attributesToClear = new Set(
      peruFinancerDependentAttributeTypeUuids.filter(
        (attributeTypeUuid) =>
          Boolean(attributes?.[attributeTypeUuid]) &&
          !shouldPersistPeruInsuranceAttribute(attributeTypeUuid, attributes),
      ),
    );

    if (isSisFinancer && !shouldShowAccreditationDate && accreditationCheckedAt) {
      attributesToClear.add(peruInsuranceAccreditationCheckedAtAttributeTypeUuid);
    }

    attributesToClear.forEach((attributeTypeUuid) => {
      registrationContext?.setFieldValue(`attributes.${attributeTypeUuid}`, '', false);
    });
  }, [accreditationCheckedAt, attributes, isSisFinancer, registrationContext, shouldShowAccreditationDate]);

  useEffect(() => {
    if (insuranceType === peruLegacySisPlanConceptUuid) {
      registrationContext?.setFieldValue(
        `attributes.${peruInsuranceTypeAttributeTypeUuid}`,
        peruInsuranceSisConceptUuid,
        false,
      );
    }
  }, [insuranceType, registrationContext]);

  const visibleFields = useMemo(
    () =>
      sectionDefinition.fields.filter((name) => {
        if (name === sisLookupField || name === insuranceAccreditationStatusField) {
          return isSisFinancer;
        }
        if (name === insuranceCodeField) {
          return Boolean(insuranceType) && !isSelfFinancing;
        }
        if (name === insuranceAccreditationCheckedAtField) {
          return shouldShowAccreditationDate;
        }
        return true;
      }),
    [insuranceType, isSelfFinancing, isSisFinancer, sectionDefinition.fields, shouldShowAccreditationDate],
  );

  return (
    <section className={styles.formSection} aria-label={`${sectionDefinition.name} Section`}>
      {visibleFields.map((name) => (
        <Field key={`${sectionDefinition.name}-${name}`} name={name} />
      ))}
    </section>
  );
};
