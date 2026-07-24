import { EncounterLocationAdapter } from './encounter-location-adapter';
import { EncounterProviderAdapter } from './encounter-provider-adapter';

const field = {} as never;
const context = {
  currentProvider: { uuid: 'current-provider-uuid', display: 'Doctor actual' },
  location: { uuid: 'current-location-uuid', display: 'Consultorio actual' },
} as never;

describe('encounter defaults adapters', () => {
  it('defaults the responsible professional to the authenticated provider', () => {
    expect(EncounterProviderAdapter.getInitialValue(field, {} as never, context)).toBe('current-provider-uuid');
  });

  it('preserves the encounter provider while editing', () => {
    const encounter = {
      encounterProviders: [{ provider: { uuid: 'saved-provider-uuid', display: 'Doctor guardado' } }],
    } as never;

    expect(EncounterProviderAdapter.getInitialValue(field, encounter, context)).toBe('saved-provider-uuid');
  });

  it('defaults the consulting room to the current visit location', () => {
    expect(EncounterLocationAdapter.getInitialValue(field, {} as never, context)).toBe('current-location-uuid');
  });

  it('preserves the encounter location while editing', () => {
    const encounter = {
      location: { uuid: 'saved-location-uuid', display: 'Consultorio guardado' },
    } as never;

    expect(EncounterLocationAdapter.getInitialValue(field, encounter, context)).toBe('saved-location-uuid');
  });
});
