import visitNoteConfigSchema, { defaultVisitNoteClinicalConceptUuids } from './visit-note-config-schema';

describe('visit note clinical concept defaults', () => {
  it('uses distinct SIHSALUS concepts for independently persisted note sections', () => {
    expect(defaultVisitNoteClinicalConceptUuids).toMatchObject({
      // The coded question, NOT the "Codigos Prestacionales" ConvSet (e82d45de…):
      // the set's N/A datatype rejects every value and aborts the encounter POST.
      codigoPrestacionalConceptUuid: '34630b86-5106-4aea-8382-f55c02e4ba2c',
      anamnesisConceptUuid: '6d99603e-ae9d-4838-8a09-ba75e27ff1e9',
      biologicalFunctionsConceptUuid: '9011adf4-2b9f-4ecb-a44c-cb5642e4e015',
      soapSubjectiveConceptUuid: 'f0000202-0000-4000-8000-000000000202',
      soapPlanConceptUuid: 'f0000201-0000-4000-8000-000000000201',
      // These defaults intentionally match the datatypes provisioned by SIHSALUS content.
      labOrdersConceptUuid: 'f0000204-0000-4000-8000-000000000204',
      prescriptionsConceptUuid: 'f0000215-0000-4000-8000-000000000215',
      nextAppointmentConceptUuid: 'f0000004-0000-4000-8000-000000000004',
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
