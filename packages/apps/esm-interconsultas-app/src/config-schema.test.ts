import { configSchema } from './config-schema';

describe('interconsultas configuration defaults', () => {
  it('uses the SIHSALUS service catalog by default', () => {
    expect(configSchema.orderableConceptSets._default).toEqual(['4bf3f465-ac91-44fa-9b1f-173daf0c89a0']);
  });
});
