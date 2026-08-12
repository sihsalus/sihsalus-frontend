import { getDefaultsFromConfigSchema } from '@openmrs/esm-framework';
import {
  ACCREDITATION_CHECKED_AT_PERSON_ATTRIBUTE_TYPE_UUID,
  ACCREDITATION_STATUS_PERSON_ATTRIBUTE_TYPE_UUID,
  FINANCIADOR_VISIT_ATTRIBUTE_TYPE_UUID,
  INSURANCE_CODE_PERSON_ATTRIBUTE_TYPE_UUID,
  INSURANCE_NUMBER_VISIT_ATTRIBUTE_TYPE_UUID,
  INSURANCE_TYPE_PERSON_ATTRIBUTE_TYPE_UUID,
  SIS_ACCREDITATION_CHECKED_AT_VISIT_ATTRIBUTE_TYPE_UUID,
  SIS_ACCREDITATION_STATUS_VISIT_ATTRIBUTE_TYPE_UUID,
} from '@openmrs/esm-patient-common-lib';

import {
  type ChartConfig,
  esmPatientChartSchema,
  resolveCanonicalCoveragePersonAttributeMappings,
  resolveCanonicalCoverageVisitAttributeTypes,
} from './config-schema';

describe('patient chart configuration defaults', () => {
  it('uses the SIHSALUS visit persistence token attribute', () => {
    expect(esmPatientChartSchema.visitPersistenceTokenAttributeTypeUuid._default).toBe(
      'eb8b793b-f259-451d-9c09-53aa0ffd0d3f',
    );
  });

  it('uses a visit attribute to persist a companion per consultation', () => {
    expect(esmPatientChartSchema.companionVisitAttributeTypeUuid._default).toBe('710da0b9-e15f-47f0-827a-e97f1937c81d');
  });

  it('captures the complete canonical person-to-visit coverage bundle', () => {
    const config = getDefaultsFromConfigSchema(esmPatientChartSchema) as ChartConfig;
    const configuredVisitAttributes = new Set(config.visitAttributeTypes.map(({ uuid }) => uuid));

    expect(configuredVisitAttributes.has(FINANCIADOR_VISIT_ATTRIBUTE_TYPE_UUID)).toBe(true);
    expect(configuredVisitAttributes.has(INSURANCE_NUMBER_VISIT_ATTRIBUTE_TYPE_UUID)).toBe(true);
    expect(configuredVisitAttributes.has(SIS_ACCREDITATION_STATUS_VISIT_ATTRIBUTE_TYPE_UUID)).toBe(true);
    expect(configuredVisitAttributes.has(SIS_ACCREDITATION_CHECKED_AT_VISIT_ATTRIBUTE_TYPE_UUID)).toBe(true);
    expect(config.defaultVisitAttributesFromPersonAttributes).toEqual(
      expect.arrayContaining([
        {
          personAttributeTypeUuid: INSURANCE_TYPE_PERSON_ATTRIBUTE_TYPE_UUID,
          visitAttributeTypeUuid: FINANCIADOR_VISIT_ATTRIBUTE_TYPE_UUID,
        },
        {
          personAttributeTypeUuid: INSURANCE_CODE_PERSON_ATTRIBUTE_TYPE_UUID,
          visitAttributeTypeUuid: INSURANCE_NUMBER_VISIT_ATTRIBUTE_TYPE_UUID,
        },
        {
          personAttributeTypeUuid: ACCREDITATION_STATUS_PERSON_ATTRIBUTE_TYPE_UUID,
          visitAttributeTypeUuid: SIS_ACCREDITATION_STATUS_VISIT_ATTRIBUTE_TYPE_UUID,
        },
        {
          personAttributeTypeUuid: ACCREDITATION_CHECKED_AT_PERSON_ATTRIBUTE_TYPE_UUID,
          visitAttributeTypeUuid: SIS_ACCREDITATION_CHECKED_AT_VISIT_ATTRIBUTE_TYPE_UUID,
        },
      ]),
    );
  });

  it('restores the canonical coverage contract after generic array overrides', () => {
    const customVisitAttribute = {
      uuid: 'custom-visit-attribute',
      required: true,
      displayInThePatientBanner: true,
    };
    const customMapping = {
      personAttributeTypeUuid: 'custom-person-attribute',
      visitAttributeTypeUuid: 'custom-visit-attribute',
    };

    expect(resolveCanonicalCoverageVisitAttributeTypes([customVisitAttribute])).toEqual(
      expect.arrayContaining([
        customVisitAttribute,
        expect.objectContaining({ uuid: FINANCIADOR_VISIT_ATTRIBUTE_TYPE_UUID }),
        expect.objectContaining({ uuid: INSURANCE_NUMBER_VISIT_ATTRIBUTE_TYPE_UUID }),
        expect.objectContaining({ uuid: SIS_ACCREDITATION_STATUS_VISIT_ATTRIBUTE_TYPE_UUID }),
        expect.objectContaining({ uuid: SIS_ACCREDITATION_CHECKED_AT_VISIT_ATTRIBUTE_TYPE_UUID }),
      ]),
    );
    expect(
      resolveCanonicalCoveragePersonAttributeMappings([
        customMapping,
        {
          personAttributeTypeUuid: INSURANCE_TYPE_PERSON_ATTRIBUTE_TYPE_UUID,
          visitAttributeTypeUuid: 'invalid-local-financiador-target',
        },
      ]),
    ).toEqual(
      expect.arrayContaining([
        customMapping,
        {
          personAttributeTypeUuid: INSURANCE_TYPE_PERSON_ATTRIBUTE_TYPE_UUID,
          visitAttributeTypeUuid: FINANCIADOR_VISIT_ATTRIBUTE_TYPE_UUID,
        },
      ]),
    );
    expect(
      resolveCanonicalCoveragePersonAttributeMappings([
        {
          personAttributeTypeUuid: INSURANCE_TYPE_PERSON_ATTRIBUTE_TYPE_UUID,
          visitAttributeTypeUuid: 'invalid-local-financiador-target',
        },
      ]),
    ).not.toContainEqual(expect.objectContaining({ visitAttributeTypeUuid: 'invalid-local-financiador-target' }));
  });
});
