export const formatPatientName = (patient): string => {
  if (!patient || !patient.name || patient.name.length === 0) {
    return '';
  }
  const nameObj = patient.name[0];
  if (nameObj.text) {
    return nameObj.text;
  }
  const givenNames = nameObj.given ? nameObj.given.join(' ') : '';
  const familyName = nameObj.family || '';
  return `${familyName} ${givenNames}`.trim();
};

interface FamilyClassifiableRelationship {
  relationshipTypeUUID: string;
  consanguinityDegree: number;
}

/**
 * A relationship counts as family when its type carries a consanguinity degree
 * (relationship type weight >= 1 in sihsalus-content) or when it is listed in the
 * configured family types — the list covers non-consanguineous family such as spouses,
 * step-parents and adoptive parents, whose weight is 0.
 */
export function isFamilyRelationship(
  relationship: FamilyClassifiableRelationship,
  familyRelationshipTypeUUIDs: ReadonlySet<string>,
) {
  return relationship.consanguinityDegree >= 1 || familyRelationshipTypeUUIDs.has(relationship.relationshipTypeUUID);
}

/** Orders relatives by consanguinity degree (1° first); non-consanguineous last. */
export function sortByConsanguinityDegree<T extends { consanguinityDegree: number }>(relationships: Array<T>) {
  const order = (degree: number) => (degree >= 1 ? degree : Number.MAX_SAFE_INTEGER);
  return [...relationships].sort((a, b) => order(a.consanguinityDegree) - order(b.consanguinityDegree));
}
