import { type Response } from '@playwright/test';
import { clinicalActivityHeartbeatUrl } from '../../packages/apps/esm-primary-navigation-app/src/clinical-activity-heartbeat';

const restResources = new Set([
  'session',
  'user',
  'person',
  'patient',
  'visit',
  'encounter',
  'obs',
  'order',
  'concept',
  'conceptclass',
  'drug',
  'patientidentifiertype',
  'provider',
  'location',
  'visittype',
  'encountertype',
  'careSetting',
  'privilege',
  'role',
  'relationship',
  'relationshiptype',
  'systemsetting',
  'appointment',
  'appointmentscheduling',
  'emrapi',
  'sihsalus',
]);
const fhirResources = new Set([
  'Patient',
  'Person',
  'Practitioner',
  'Encounter',
  'Observation',
  'Condition',
  'ServiceRequest',
  'MedicationRequest',
  'DiagnosticReport',
  'DocumentReference',
  'ImagingStudy',
  'Appointment',
  'Location',
  'AllergyIntolerance',
  'Immunization',
  'Medication',
  'MedicationDispense',
  'Procedure',
  'CarePlan',
  'Bundle',
  'metadata',
]);
const spaFiles = new Set([
  'build-info.json',
  'importmap.json',
  'routes.registry.json',
  'index.html',
  'favicon.ico',
  'service-worker.js',
  'manifest.json',
]);
// Flat emitted SPA assets only; clinical routes and arbitrary filenames never use this exception.
const emittedAsset =
  /^(?:[a-f0-9]{8,64}|esm-(?:[a-z]+-)*[a-z]+-\d{1,6}-[a-f0-9]{8,64}|(?:openmrs|sihsalus)-esm-(?:[a-z]+-)*[a-z]+\.[a-f0-9]{8,64})\.(?:js|css)(?:\.map)?$/;

function requestPathTemplate(segments: string[]): string {
  const redact = (parts: string[]) => parts.map((part) => (part ? '[redacted]' : ''));
  const prefix = segments.slice(0, 4).join('/');
  const resource = segments[4] ?? '';
  if (prefix === 'openmrs/ws/rest/v1' || prefix === 'openmrs/ws/fhir2/R4') {
    const resources = prefix.endsWith('/R4') ? fhirResources : restResources;
    return [prefix, resources.has(resource) ? resource : '[redacted]', ...redact(segments.slice(5))].join('/');
  }
  if (segments[0] === 'openmrs' && segments[1] === 'spa') {
    const file = segments[2] ?? '';
    if (segments.length === 3 && (spaFiles.has(file) || emittedAsset.test(file))) return segments.join('/');
    return ['openmrs', 'spa', ...redact(segments.slice(2))].join('/');
  }
  return redact(segments).join('/');
}

/** Diagnostic paths only: never include query strings, credentials or clinical identifiers. */
export function sanitizeE2ERequestUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return '[redacted-url]';
    // Ambiguous encoded separators or repeated encoding cannot safely identify resource boundaries.
    if (/%(?:2f|5c|25)/i.test(url.pathname) || url.pathname.includes('//')) return '[redacted-url]';
    if (url.pathname === clinicalActivityHeartbeatUrl) return `${url.origin}${clinicalActivityHeartbeatUrl}`;
    const segments = decodeURIComponent(url.pathname)
      .split('/')
      .slice(1)
      .map((part) => part.split(';')[0] ?? '');
    return `${url.origin}/${requestPathTemplate(segments)}`;
  } catch {
    return '[redacted-url]';
  }
}

export function describeE2EHttpFailure(response: Pick<Response, 'status' | 'url' | 'request'>) {
  const status = response.status();
  if (status < 400) return undefined;
  return {
    method: response.request().method(),
    status,
    url: sanitizeE2ERequestUrl(response.url()),
  };
}
