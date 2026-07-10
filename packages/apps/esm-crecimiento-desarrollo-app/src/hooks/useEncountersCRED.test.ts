import type { ConfigObject } from '../config-schema';

import { getConfiguredCREDFormIdentifiers } from './useEncountersCRED';

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
