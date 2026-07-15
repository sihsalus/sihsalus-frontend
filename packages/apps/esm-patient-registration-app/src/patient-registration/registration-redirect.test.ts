import { resolveRegistrationAfterUrl } from './registration-redirect';

describe('resolveRegistrationAfterUrl', () => {
  it.each([
    [
      `/openmrs/spa/forms/form/form-uuid?patientUuid=\${patientUuid}`,
      '/openmrs/spa/forms/form/form-uuid?patientUuid=patient-uuid',
    ],
    [
      `\${openmrsSpaBase}/forms/form/form-uuid?patientUuid=\${patientUuid}`,
      '/openmrs/spa/forms/form/form-uuid?patientUuid=patient-uuid',
    ],
    [`/openmrs/spa/patient/\${patientUuid}/chart#summary`, '/openmrs/spa/patient/patient-uuid/chart#summary'],
  ])('accepts the safe return target %s', (rawAfterUrl, expected) => {
    expect(resolveRegistrationAfterUrl(rawAfterUrl, 'patient-uuid')).toBe(expected);
  });

  it.each([
    null,
    '',
    'forms/form/form-uuid',
    '//malicious.example/forms/form/form-uuid',
    'https://malicious.example/forms/form/form-uuid',
    'javascript:alert(1)',
    `\${openmrsBase}/forms/form/form-uuid`,
    `\${arbitraryTemplate}/forms/form/form-uuid`,
    `/forms/form/\${arbitraryTemplate}`,
    `/forms/form/\${openmrsSpaBase}`,
    `\${openmrsSpaBase}//malicious.example/forms/form/form-uuid`,
    '/\\malicious.example/forms/form/form-uuid',
    '/../..//malicious.example/forms/form/form-uuid',
  ])('rejects the unsafe return target %s', (rawAfterUrl) => {
    expect(resolveRegistrationAfterUrl(rawAfterUrl, 'patient-uuid')).toBeNull();
  });
});
