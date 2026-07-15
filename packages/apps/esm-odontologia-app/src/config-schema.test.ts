import { configSchema } from './config-schema';
import { defaultAmpathOdontogramFormPersistence } from './odontogram/ampath-form-odontogram-config';

describe('odontologia configuration defaults', () => {
  it('uses the published SIHSALUS dental forms', () => {
    expect(configSchema.dentalFormUuid._default).toBe('afcb3a21-d3a2-390e-966f-1cbcdc9b7c25');
    expect(defaultAmpathOdontogramFormPersistence).toMatchObject({
      formUuid: '1d4ca5a3-79d9-3380-8974-e87af3105631',
      baseFormUuid: '1d4ca5a3-79d9-3380-8974-e87af3105631',
      attentionFormUuid: 'a48b004b-526e-32b5-8965-7dc4ffcb52f1',
    });
  });
});
