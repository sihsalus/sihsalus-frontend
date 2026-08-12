import {
  FINANCIADOR_VISIT_ATTRIBUTE_TYPE_UUID,
  INSURANCE_NUMBER_VISIT_ATTRIBUTE_TYPE_UUID,
  LEGACY_SIS_PRODUCT_CONCEPT_UUIDS,
  SELF_FINANCED_CONCEPT_UUID,
  SIS_ACCREDITATION_CHECKED_AT_VISIT_ATTRIBUTE_TYPE_UUID,
  SIS_ACCREDITATION_STATUS_VISIT_ATTRIBUTE_TYPE_UUID,
  SIS_CONCEPT_UUID,
} from '@openmrs/esm-patient-common-lib';

import { shouldClearCoverageComplements, shouldShowCoverageVisitAttribute } from './visit-attribute-type.component';

describe('shouldShowCoverageVisitAttribute', () => {
  it('hides all dependent fields until a financer is selected', () => {
    expect(shouldShowCoverageVisitAttribute(INSURANCE_NUMBER_VISIT_ATTRIBUTE_TYPE_UUID)).toBe(false);
    expect(shouldShowCoverageVisitAttribute(SIS_ACCREDITATION_STATUS_VISIT_ATTRIBUTE_TYPE_UUID)).toBe(false);
  });

  it('shows only the financer for self-financed care', () => {
    const attributes = { [FINANCIADOR_VISIT_ATTRIBUTE_TYPE_UUID]: SELF_FINANCED_CONCEPT_UUID };

    expect(shouldShowCoverageVisitAttribute(FINANCIADOR_VISIT_ATTRIBUTE_TYPE_UUID, attributes)).toBe(true);
    expect(shouldShowCoverageVisitAttribute(INSURANCE_NUMBER_VISIT_ATTRIBUTE_TYPE_UUID, attributes)).toBe(false);
    expect(shouldShowCoverageVisitAttribute(SIS_ACCREDITATION_STATUS_VISIT_ATTRIBUTE_TYPE_UUID, attributes)).toBe(
      false,
    );
    expect(shouldShowCoverageVisitAttribute(SIS_ACCREDITATION_CHECKED_AT_VISIT_ATTRIBUTE_TYPE_UUID, attributes)).toBe(
      false,
    );
  });

  it('shows a policy but no SIS accreditation fields for another IAFAS', () => {
    const attributes = { [FINANCIADOR_VISIT_ATTRIBUTE_TYPE_UUID]: 'essalud-concept' };

    expect(shouldShowCoverageVisitAttribute(INSURANCE_NUMBER_VISIT_ATTRIBUTE_TYPE_UUID, attributes)).toBe(true);
    expect(shouldShowCoverageVisitAttribute(SIS_ACCREDITATION_STATUS_VISIT_ATTRIBUTE_TYPE_UUID, attributes)).toBe(
      false,
    );
    expect(shouldShowCoverageVisitAttribute(SIS_ACCREDITATION_CHECKED_AT_VISIT_ATTRIBUTE_TYPE_UUID, attributes)).toBe(
      false,
    );
  });

  it.each([
    SIS_CONCEPT_UUID,
    ...LEGACY_SIS_PRODUCT_CONCEPT_UUIDS,
  ])('shows the affiliation and SIS accreditation fields for %s', (sisFinanciador) => {
    const attributes = { [FINANCIADOR_VISIT_ATTRIBUTE_TYPE_UUID]: sisFinanciador };

    expect(shouldShowCoverageVisitAttribute(INSURANCE_NUMBER_VISIT_ATTRIBUTE_TYPE_UUID, attributes)).toBe(true);
    expect(shouldShowCoverageVisitAttribute(SIS_ACCREDITATION_STATUS_VISIT_ATTRIBUTE_TYPE_UUID, attributes)).toBe(true);
    expect(shouldShowCoverageVisitAttribute(SIS_ACCREDITATION_CHECKED_AT_VISIT_ATTRIBUTE_TYPE_UUID, attributes)).toBe(
      true,
    );
  });
});

describe('shouldClearCoverageComplements', () => {
  it('clears affiliation and accreditation when the effective financer changes', () => {
    expect(shouldClearCoverageComplements(SIS_CONCEPT_UUID, 'essalud-concept')).toBe(true);
    expect(shouldClearCoverageComplements(SIS_CONCEPT_UUID, SELF_FINANCED_CONCEPT_UUID)).toBe(true);
    expect(shouldClearCoverageComplements(SELF_FINANCED_CONCEPT_UUID, SIS_CONCEPT_UUID)).toBe(true);
  });

  it('does not clear fields when a legacy SIS plan is normalized to canonical SIS', () => {
    expect(shouldClearCoverageComplements(LEGACY_SIS_PRODUCT_CONCEPT_UUIDS[0], SIS_CONCEPT_UUID)).toBe(false);
    expect(shouldClearCoverageComplements(SIS_CONCEPT_UUID, SIS_CONCEPT_UUID)).toBe(false);
  });
});
