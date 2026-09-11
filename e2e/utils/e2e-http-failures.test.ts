import { type Request, type Response } from '@playwright/test';
import { describe, expect, it } from 'vitest';
import { describeE2EHttpFailure, sanitizeE2ERequestUrl } from './e2e-http-failures';

describe('E2E HTTP failure diagnostics', () => {
  it('keeps the failing endpoint without credentials, query parameters or fragments', () => {
    expect(
      sanitizeE2ERequestUrl('https://user:secret@example.test/openmrs/ws/rest/v1/session?token=secret#private'),
    ).toBe('https://example.test/openmrs/ws/rest/v1/session');
  });

  it.each([
    'patient',
    'person',
    'visit',
    'encounter',
    'obs',
    'appointment',
  ])('retains only the REST resource and redacts all nested identifiers after %s', (resource) => {
    expect(
      sanitizeE2ERequestUrl(`https://example.test/openmrs/ws/rest/v1/${resource}/synthetic-id/name/other-id`),
    ).toBe(`https://example.test/openmrs/ws/rest/v1/${resource}/[redacted]/[redacted]/[redacted]`);
  });

  it.each([
    'Patient',
    'Person',
    'Observation',
    'DocumentReference',
    'ImagingStudy',
  ])('redacts FHIR logical identifiers, history IDs and nested resources after %s', (resource) => {
    expect(
      sanitizeE2ERequestUrl(`https://example.test/openmrs/ws/fhir2/R4/${resource}/synthetic-id/_history/revision`),
    ).toBe(`https://example.test/openmrs/ws/fhir2/R4/${resource}/[redacted]/[redacted]/[redacted]`);
  });

  it.each([
    'patients',
    'visits',
    'encounters',
    'appointments',
    'unknown',
  ])('redacts unknown route %s completely', (resource) => {
    expect(sanitizeE2ERequestUrl(`https://example.test/${resource}/synthetic-id`)).toBe(
      'https://example.test/[redacted]/[redacted]',
    );
  });

  it('redacts encoded resource identifiers, UUIDs, numeric IDs and path session parameters', () => {
    expect(
      sanitizeE2ERequestUrl(
        'https://example.test/openmrs/ws/rest/v1/%70atient/opaque%20id/visit/12/obs/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee;jsessionid=secret',
      ),
    ).toBe('https://example.test/openmrs/ws/rest/v1/patient/[redacted]/[redacted]/[redacted]/[redacted]/[redacted]');
  });

  it.each([
    'build-info.json',
    'esm-home-877-79334b93.js',
    'openmrs-esm-home-app.23fc1186eea7ddc6.js',
    'e0adad8a8579bf99f3e22f7c214a5c64.css',
  ])('retains a validated flat SPA asset filename (%s)', (file) => {
    expect(sanitizeE2ERequestUrl(`https://example.test/openmrs/spa/${file}?token=private`)).toBe(
      `https://example.test/openmrs/spa/${file}`,
    );
  });

  it.each([
    'synthetic-name.js',
    'esm-home-synthetic-name-79334b93.js',
    'esm-home-877-invalid-hash.js',
  ])('redacts an unverified SPA filename (%s)', (file) => {
    expect(sanitizeE2ERequestUrl(`https://example.test/openmrs/spa/${file}`)).toBe(
      'https://example.test/openmrs/spa/[redacted]',
    );
  });

  it('does not use the static asset exception in clinical or nested paths', () => {
    const file = 'esm-home-877-79334b93.js';
    expect(sanitizeE2ERequestUrl(`https://example.test/openmrs/ws/rest/v1/person/${file}`)).toBe(
      'https://example.test/openmrs/ws/rest/v1/person/[redacted]',
    );
    expect(sanitizeE2ERequestUrl(`https://example.test/openmrs/spa/patient/synthetic-id/${file}`)).toBe(
      'https://example.test/openmrs/spa/[redacted]/[redacted]/[redacted]',
    );
  });

  it.each([
    'invalid URL',
    'https://example.test/%zz?secret=x',
    'https://example.test/patient/opaque%2Fid',
    'https://example.test/%2570atient/opaque-id',
    'https://example.test/openmrs/ws/rest/v1/patient//synthetic-id',
    'https://example.test/visit//synthetic-id',
    'https://example.test/encounter//synthetic-id',
    'data:text/plain,secret',
  ])('fails closed for an unsafe URL (%s)', (url) => expect(sanitizeE2ERequestUrl(url)).toBe('[redacted-url]'));

  it('reports only method, status and sanitized URL for a 404, without reading headers or bodies', () => {
    const response: Pick<Response, 'status' | 'url' | 'request'> = {
      status: () => 404,
      url: () => 'https://example.test/openmrs/ws/rest/v1/missing?q=private',
      request: () => ({ method: () => 'GET' }) as Request,
    };
    expect(describeE2EHttpFailure(response)).toEqual({
      method: 'GET',
      status: 404,
      url: 'https://example.test/openmrs/ws/rest/v1/[redacted]',
    });
  });

  it('does not record successful requests', () => {
    const response = { status: () => 200 } as Pick<Response, 'status' | 'url' | 'request'>;
    expect(describeE2EHttpFailure(response)).toBeUndefined();
  });
});
