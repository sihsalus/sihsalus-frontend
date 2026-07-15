import type { SearchedPatient } from '../types';

import {
  admissionIdentificationStatusAttributeTypeUuid,
  admissionIdentificationStatusConceptUuids,
  matchesPersonAttributeFilter,
} from './person-attribute-filter';

type PersonAttribute = SearchedPatient['attributes'][number];

const attributeType = {
  uuid: admissionIdentificationStatusAttributeTypeUuid,
  display: 'Estado de Identificación en Admisión',
};

describe('matchesPersonAttributeFilter', () => {
  it.each([
    {
      label: 'a hydrated concept',
      attribute: {
        value: {
          uuid: admissionIdentificationStatusConceptUuids.merged,
          display: 'Fusionado con registro existente',
        },
        attributeType,
      },
    },
    {
      label: 'a legacy status code',
      attribute: { value: 'merged', attributeType },
    },
    {
      label: 'a legacy display fallback whose hydrated value is null',
      attribute: { display: 'Fusionado con registro existente', value: null, attributeType },
    },
  ])('matches Fusionado when the REST attribute contains $label', ({ attribute }) => {
    expect(
      matchesPersonAttributeFilter(
        attribute as PersonAttribute,
        admissionIdentificationStatusAttributeTypeUuid,
        admissionIdentificationStatusConceptUuids.merged,
      ),
    ).toBe(true);
  });

  it('does not throw or match when an attribute has neither a hydrated nor serialized value', () => {
    expect(
      matchesPersonAttributeFilter(
        { value: null, attributeType },
        admissionIdentificationStatusAttributeTypeUuid,
        admissionIdentificationStatusConceptUuids.merged,
      ),
    ).toBe(false);
  });

  it('preserves UUID matching for newly configured admission statuses', () => {
    const configuredConceptUuid = '275dc927-e15a-4b45-8c06-21e881f0513b';

    expect(
      matchesPersonAttributeFilter(
        {
          value: { uuid: configuredConceptUuid, display: 'Estado configurado' },
          attributeType,
        },
        admissionIdentificationStatusAttributeTypeUuid,
        configuredConceptUuid,
      ),
    ).toBe(true);
  });
});
