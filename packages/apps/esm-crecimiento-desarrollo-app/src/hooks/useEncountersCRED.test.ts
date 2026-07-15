import type { ConfigObject } from '../config-schema';

import {
  attachCREDControlNumbers,
  findCREDFormEncounterForControl,
  getConfiguredCREDFormIdentifiers,
} from './useEncountersCRED';

describe('getConfiguredCREDFormIdentifiers', () => {
  it('keeps legacy CRED forms in history after they leave the current age matrix', () => {
    const config = {
      formsList: {
        stimulationFollowupForm: 'CRED-004-SEGUIMIENTO DEL DESARROLLO',
      },
      CREDFormsByAgeGroup: [],
    } as unknown as ConfigObject;

    const identifiers = getConfiguredCREDFormIdentifiers(config);

    expect(identifiers).toContain('cred-004-seguimiento del desarrollo');
    expect(identifiers).toContain('cred-026-huanca test vigilancia neurodesarrollo');
  });
});

describe('attachCREDControlNumbers', () => {
  it('attaches numeric and numeric-string control values to their encounters', () => {
    const encounters = attachCREDControlNumbers(
      [{ uuid: 'encounter-1' }, { uuid: 'encounter-2' }, { uuid: 'encounter-3' }],
      [
        { uuid: 'obs-1', encounter: { uuid: 'encounter-1' }, value: 1 },
        { uuid: 'obs-2', encounter: { uuid: 'encounter-2' }, value: '2' },
      ],
    );

    expect(encounters).toEqual([
      { uuid: 'encounter-1', controlNumber: 1 },
      { uuid: 'encounter-2', controlNumber: 2 },
      { uuid: 'encounter-3', controlNumber: undefined },
    ]);
  });

  it.each([0, 28, 'invalid'])('ignores an invalid persisted control number (%s)', (value) => {
    const encounters = attachCREDControlNumbers(
      [{ uuid: 'encounter-1' }],
      [{ uuid: 'obs-1', encounter: { uuid: 'encounter-1' }, value }],
    );

    expect(encounters).toEqual([{ uuid: 'encounter-1', controlNumber: undefined }]);
  });
});

describe('findCREDFormEncounterForControl', () => {
  const encounters = [
    {
      uuid: 'control-1-form',
      encounterDatetime: '2026-02-10T09:00:00-05:00',
      form: { uuid: 'cred-form' },
      controlNumber: 1,
    },
    {
      uuid: 'control-2-form',
      encounterDatetime: '2026-07-10T09:00:00-05:00',
      form: { uuid: 'cred-form' },
      controlNumber: 2,
    },
  ];

  it('selects the encounter from the current control instead of the latest historical control', () => {
    expect(findCREDFormEncounterForControl(encounters, 'cred-form', 1)).toBe('control-1-form');
  });

  it('returns no encounter when the form has not been completed in the current control', () => {
    expect(findCREDFormEncounterForControl(encounters, 'another-form', 1)).toBeUndefined();
  });

  it('does not resolve an encounter for an invalid control number', () => {
    expect(findCREDFormEncounterForControl(encounters, 'cred-form', 0)).toBeUndefined();
  });
});
