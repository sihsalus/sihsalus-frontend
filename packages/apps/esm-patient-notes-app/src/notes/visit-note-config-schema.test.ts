import visitNoteConfigSchema, { defaultVisitNoteClinicalConceptUuids } from './visit-note-config-schema';

describe('visit note clinical concept defaults', () => {
  it('uses distinct SIHSALUS concepts for independently persisted note sections', () => {
    expect(defaultVisitNoteClinicalConceptUuids).toMatchObject({
      codigoPrestacionalConceptUuid: 'e82d45de-8696-42f8-99bc-337a750a7102',
      anamnesisConceptUuid: '6d99603e-ae9d-4838-8a09-ba75e27ff1e9',
      biologicalFunctionsConceptUuid: '9011adf4-2b9f-4ecb-a44c-cb5642e4e015',
      soapSubjectiveConceptUuid: 'f0000202-0000-4000-8000-000000000202',
      soapPlanConceptUuid: 'f0000201-0000-4000-8000-000000000201',
    });

    const independentlyPersistedConceptUuids = [
      visitNoteConfigSchema.encounterNoteTextConceptUuid._default,
      defaultVisitNoteClinicalConceptUuids.codigoPrestacionalConceptUuid,
      defaultVisitNoteClinicalConceptUuids.anamnesisConceptUuid,
      defaultVisitNoteClinicalConceptUuids.biologicalFunctionsConceptUuid,
      defaultVisitNoteClinicalConceptUuids.soapSubjectiveConceptUuid,
      defaultVisitNoteClinicalConceptUuids.soapPlanConceptUuid,
    ];

    expect(new Set(independentlyPersistedConceptUuids).size).toBe(independentlyPersistedConceptUuids.length);
  });
});
