import { getAnamnesisObsValue, hasAnamnesisData, mapEncounterToAnamnesisEntry } from './anamnesis';

describe('anamnesis domain helpers', () => {
  it('maps OpenMRS encounter obs into a structured anamnesis entry', () => {
    const entry = mapEncounterToAnamnesisEntry(
      {
        uuid: 'encounter-uuid',
        encounterDatetime: '2026-04-27T10:00:00.000Z',
        encounterProviders: [{ display: 'Dra. Perez - Clinician' }],
        obs: [
          { concept: { uuid: 'chief' }, value: 'Dolor abdominal' },
          { concept: { uuid: 'duration' }, value: '3 dias' },
          { concept: { uuid: 'onset' }, value: { uuid: 'sudden', display: 'Brusco' } },
          { concept: { uuid: 'narrative' }, value: 'Inicio posterior a alimentos.' },
          { concept: { uuid: 'appetite' }, value: 'Disminuido' },
        ],
      },
      {
        chiefComplaintUuid: 'chief',
        illnessDurationUuid: 'duration',
        onsetTypeUuid: 'onset',
        anamnesisUuid: 'narrative',
        appetiteUuid: 'appetite',
      },
    );

    expect(entry.provider).toBe('Dra. Perez');
    expect(entry.chiefComplaint).toBe('Dolor abdominal');
    expect(entry.illnessDuration).toBe('3 dias');
    expect(entry.onsetType).toBe('Brusco');
    expect(entry.narrative).toBe('Inicio posterior a alimentos.');
    expect(entry.biologicalFunctions.appetite).toBe('Disminuido');
    expect(hasAnamnesisData(entry)).toBe(true);
  });

  it('returns null for missing concept values', () => {
    expect(getAnamnesisObsValue([{ concept: { uuid: 'other' }, value: 'x' }], 'chief')).toBeNull();
  });
});
