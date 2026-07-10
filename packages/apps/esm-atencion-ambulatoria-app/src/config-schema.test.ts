import { configSchema } from './config-schema';

describe('Atencion Ambulatoria configuration', () => {
  it('identifies the anamnesis form by its stable published name', () => {
    expect(configSchema.formsList._default.anamnesisForm).toBe('CE-ANAM-001-ANAMNESIS');
  });
});
