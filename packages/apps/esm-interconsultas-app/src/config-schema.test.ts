import { configSchema } from './config-schema';

describe('interconsultas configuration defaults', () => {
  it('uses the SIHSALUS service catalog by default', () => {
    expect(configSchema.orderableConceptSets._default).toEqual(['4bf3f465-ac91-44fa-9b1f-173daf0c89a0']);
    expect(configSchema.excludedDestinationConceptUuids._default).toContain('b866f130-b413-417f-ad5b-5b65daadbcf5');
    expect(configSchema.externalSpecialistConceptUuid._default).toBe('4cf9f13f-bbac-50db-8fac-85205b58b44c');
  });
});
