import { isFamilyRelationship, sortByConsanguinityDegree } from './utils';

const configuredFamilyTypes = new Set(['spouse-type-uuid']);

describe('isFamilyRelationship', () => {
  it('treats any consanguinity degree >= 1 as family, regardless of the configured list', () => {
    expect(
      isFamilyRelationship({ relationshipTypeUUID: 'unlisted-type', consanguinityDegree: 1 }, configuredFamilyTypes),
    ).toBe(true);
    expect(
      isFamilyRelationship({ relationshipTypeUUID: 'unlisted-type', consanguinityDegree: 4 }, configuredFamilyTypes),
    ).toBe(true);
  });

  it('treats configured types without consanguinity (spouses, adoptive) as family', () => {
    expect(
      isFamilyRelationship({ relationshipTypeUUID: 'spouse-type-uuid', consanguinityDegree: 0 }, configuredFamilyTypes),
    ).toBe(true);
  });

  it('excludes non-configured types without consanguinity (doctor, companion)', () => {
    expect(
      isFamilyRelationship({ relationshipTypeUUID: 'doctor-type-uuid', consanguinityDegree: 0 }, configuredFamilyTypes),
    ).toBe(false);
  });
});

describe('sortByConsanguinityDegree', () => {
  it('orders by degree ascending with non-consanguineous relatives last', () => {
    const sorted = sortByConsanguinityDegree([
      { consanguinityDegree: 0, label: 'esposo' },
      { consanguinityDegree: 2, label: 'hermano' },
      { consanguinityDegree: 1, label: 'madre' },
      { consanguinityDegree: 4, label: 'primo' },
    ]);

    expect(sorted.map((relationship) => relationship.label)).toEqual(['madre', 'hermano', 'primo', 'esposo']);
  });

  it('does not mutate the input array', () => {
    const input = [{ consanguinityDegree: 2 }, { consanguinityDegree: 1 }];
    sortByConsanguinityDegree(input);
    expect(input.map((relationship) => relationship.consanguinityDegree)).toEqual([2, 1]);
  });
});
