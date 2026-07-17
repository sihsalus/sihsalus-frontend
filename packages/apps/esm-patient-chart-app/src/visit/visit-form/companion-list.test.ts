import { getPatientCompanions } from './companion-list.component';

describe('getPatientCompanions', () => {
  const patientUuid = 'patient-uuid';
  const companionRelationshipTypeUuid = 'companion-relationship-type-uuid';

  it('only returns companion relationships that belong to the patient', () => {
    const relationships = [
      {
        uuid: 'companion-from-a',
        personA: { uuid: patientUuid, display: 'Paciente' },
        personB: { uuid: 'companion-one', display: 'Acompañante Uno' },
        relationshipType: { uuid: companionRelationshipTypeUuid },
      },
      {
        uuid: 'companion-from-b',
        personA: { uuid: 'companion-two', display: 'Acompañante Dos' },
        personB: { uuid: patientUuid, display: 'Paciente' },
        relationshipType: { uuid: companionRelationshipTypeUuid },
      },
      {
        uuid: 'different-relationship',
        personA: { uuid: patientUuid, display: 'Paciente' },
        personB: { uuid: 'relative', display: 'Familiar' },
        relationshipType: { uuid: 'different-relationship-type' },
      },
      {
        uuid: 'different-patient',
        personA: { uuid: 'another-patient', display: 'Otro paciente' },
        personB: { uuid: 'another-companion', display: 'Otro acompañante' },
        relationshipType: { uuid: companionRelationshipTypeUuid },
      },
    ];

    expect(getPatientCompanions(relationships, patientUuid, companionRelationshipTypeUuid)).toEqual([
      { uuid: 'companion-from-a', name: 'Acompañante Uno' },
      { uuid: 'companion-from-b', name: 'Acompañante Dos' },
    ]);
  });
});
