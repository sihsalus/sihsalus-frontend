import { esmStyleGuideSchema } from './config-schema';

describe('SIHSALUS styleguide defaults', () => {
  it('uses the product branding without runtime overrides', () => {
    expect(esmStyleGuideSchema['Brand color #1']._default).toBe('#27348b');
    expect(esmStyleGuideSchema['Brand color #2']._default).toBe('#17205f');
    expect(esmStyleGuideSchema['Brand color #3']._default).toBe('#2c7d35');
    expect(esmStyleGuideSchema.implementationName._default).toBe('SIHSALUS');
    expect(esmStyleGuideSchema.patientPhotoConceptUuid._default).toBe('7cac8397-53cd-4f00-a6fe-028e8d743f8e');
  });
});
