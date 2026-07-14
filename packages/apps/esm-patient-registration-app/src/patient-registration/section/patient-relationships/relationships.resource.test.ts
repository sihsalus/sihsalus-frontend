import { mapPatientRelationships, type Relationship } from './relationships.resource';

const patientUuid = 'patient-uuid';
const relatedPersonUuid = 'related-person-uuid';
const companionTypeUuid = 'companion-type-uuid';

function buildRelationship(uuid: string, typeUuid: string, aIsToB: string): Relationship {
  return {
    display: aIsToB,
    uuid,
    personA: {
      age: 40,
      birthdate: '1986-01-01',
      display: 'Related Person',
      uuid: relatedPersonUuid,
    },
    personB: {
      age: 30,
      birthdate: '1996-01-01',
      display: 'Patient',
      uuid: patientUuid,
    },
    relationshipType: {
      uuid: typeUuid,
      display: aIsToB,
      aIsToB,
      bIsToA: 'Patient',
    },
  };
}

describe('mapPatientRelationships', () => {
  it('folds a companion relationship into the family relationship for the same person', () => {
    const relationships = mapPatientRelationships(
      [
        buildRelationship('family-relationship-uuid', 'family-type-uuid', 'Spouse'),
        buildRelationship('companion-relationship-uuid', companionTypeUuid, 'Companion'),
      ],
      patientUuid,
      companionTypeUuid,
    );

    expect(relationships).toEqual([
      expect.objectContaining({
        uuid: 'family-relationship-uuid',
        relatedPersonUuid,
        isCompanion: true,
        companionRelationshipUuid: 'companion-relationship-uuid',
      }),
    ]);
  });

  it('keeps a standalone companion relationship visible for editing', () => {
    const relationships = mapPatientRelationships(
      [buildRelationship('companion-relationship-uuid', companionTypeUuid, 'Companion')],
      patientUuid,
      companionTypeUuid,
    );

    expect(relationships).toEqual([
      expect.objectContaining({
        uuid: 'companion-relationship-uuid',
        relatedPersonUuid,
        relationshipType: `${companionTypeUuid}/aIsToB`,
      }),
    ]);
  });

  it('preserves the related person age and birthdate used by responsible-person validation', () => {
    const relationships = mapPatientRelationships(
      [buildRelationship('family-relationship-uuid', 'family-type-uuid', 'Parent')],
      patientUuid,
    );

    expect(relationships[0]).toMatchObject({
      relatedPersonAge: 40,
      relatedPersonBirthdate: '1986-01-01',
    });
  });
});
