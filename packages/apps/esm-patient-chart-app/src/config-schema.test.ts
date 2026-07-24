import { esmPatientChartSchema } from './config-schema';

describe('patient chart configuration defaults', () => {
  it('uses the SIHSALUS visit persistence token attribute', () => {
    expect(esmPatientChartSchema.visitPersistenceTokenAttributeTypeUuid._default).toBe(
      'eb8b793b-f259-451d-9c09-53aa0ffd0d3f',
    );
  });

  it('uses a visit attribute to persist a companion per consultation', () => {
    expect(esmPatientChartSchema.companionVisitAttributeTypeUuid._default).toBe('710da0b9-e15f-47f0-827a-e97f1937c81d');
  });
});
