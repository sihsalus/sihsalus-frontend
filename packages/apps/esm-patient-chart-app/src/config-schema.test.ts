import { esmPatientChartSchema } from './config-schema';

describe('patient chart configuration defaults', () => {
  it('uses the SIHSALUS visit persistence token attribute', () => {
    expect(esmPatientChartSchema.visitPersistenceTokenAttributeTypeUuid._default).toBe(
      'eb8b793b-f259-451d-9c09-53aa0ffd0d3f',
    );
  });
});
