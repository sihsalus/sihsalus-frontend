import { expect, test } from '@playwright/test';

const dyakuFhirBaseUrl = process.env.DYAKU_FHIR_BASE_URL ?? 'https://dyaku.minsa.gob.pe/fhir';
const dyakuGuidesBaseUrl = process.env.DYAKU_FHIR_GUIDES_BASE_URL ?? 'https://dyaku.minsa.gob.pe/guides/';
const patientProfileUrl =
  process.env.DYAKU_PATIENT_PROFILE_URL ?? 'https://www.gob.pe/minsa/RENHICE/fhir/StructureDefinition/PacientePe';

function joinUrl(baseUrl: string, path: string) {
  return `${baseUrl.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}

test.describe('Dyaku Peru FHIR2 baseline', () => {
  test('publishes a FHIR R4 CapabilityStatement at the configured Dyaku base URL', async ({ request }) => {
    const response = await request.get(joinUrl(dyakuFhirBaseUrl, 'metadata'), {
      headers: { Accept: 'application/fhir+json' },
    });

    expect(response.ok()).toBeTruthy();
    expect(response.headers()['content-type']).toContain('application/fhir+json');

    const capabilityStatement = await response.json();
    expect(capabilityStatement.resourceType).toBe('CapabilityStatement');
    expect(capabilityStatement.fhirVersion).toBe('4.0.1');
    expect(capabilityStatement.implementation?.url).toBe(dyakuFhirBaseUrl);
    expect(capabilityStatement.rest?.some((rest: { mode?: string }) => rest.mode === 'server')).toBe(true);
  });

  test('publishes the Peru Core implementation guide and Paciente Peru profile', async ({ request }) => {
    const guidesResponse = await request.get(dyakuGuidesBaseUrl);
    expect(guidesResponse.ok()).toBeTruthy();
    expect(await guidesResponse.text()).toContain(
      'https://www.gob.pe/minsa/RENHICE/fhir/ImplementationGuide/hl7.fhir.pe.CorePE',
    );

    const profileResponse = await request.get(joinUrl(dyakuGuidesBaseUrl, 'StructureDefinition-PacientePe.json'), {
      headers: { Accept: 'application/fhir+json, application/json' },
    });
    expect(profileResponse.ok()).toBeTruthy();

    const profile = await profileResponse.json();
    expect(profile.resourceType).toBe('StructureDefinition');
    expect(profile.type).toBe('Patient');
    expect(profile.url).toBe(patientProfileUrl);
    expect(profile.fhirVersion).toBe('4.0.1');
  });
});
