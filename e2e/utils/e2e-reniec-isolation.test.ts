import { type Page, type Route } from '@playwright/test';
import { describe, expect, it, vi } from 'vitest';
import { classifyReniecContractRequest, isolateReniecIdentitySearches } from './e2e-reniec-isolation';

const bases = ['http://127.0.0.1:8080/openmrs/ws/rest/v1/', 'https://dev.example.test/openmrs/ws/rest/v1/'];

describe('isolated RENIEC browser contract', () => {
  it.each(['patient', 'person'])('stubs only the exact synthetic %s search on either configured origin', (resource) => {
    for (const base of bases) {
      expect(classifyReniecContractRequest(`${base}${resource}?q=12345678&v=custom:(uuid)`, 'GET', bases)).toBe(
        resource,
      );
    }
  });

  it.each([
    'patient?q=87654321',
    'patient?q=12345678&q=87654321',
    'patient?identifier=12345678',
    'person?q=87654321',
    'person?q=12345678&q=12345678',
    'patient/synthetic-id?q=12345678',
    'person/synthetic-id?q=12345678',
    'patient/?q=12345678',
  ])('blocks unexpected patient/person reads (%s)', (path) => {
    expect(classifyReniecContractRequest(`${bases[0]}${path}`, 'GET', bases)).toBe('blocked');
  });

  it.each(['POST', 'PUT', 'PATCH', 'DELETE'])('blocks %s even on an otherwise allowed endpoint', (method) => {
    expect(classifyReniecContractRequest(`${bases[0]}patient?q=12345678`, method, bases)).toBe('blocked');
    expect(classifyReniecContractRequest(`${bases[0]}session`, method, bases)).toBe('blocked');
  });

  it.each([
    'https://external.example.test/reniec',
    'https://dev.example.test.attacker.test/openmrs/ws/rest/v1/patient?q=12345678',
    'https://dev.example.test/openmrs/ws/rest/v1/identitylookup?q=12345678',
    'http://127.0.0.1:8080/openmrs/reniec?q=12345678',
    'http://127.0.0.1:8080/openmrs/ws/fhir2/R4/Patient?identifier=12345678',
    'https://dev.example.test/openmrs/ws/fhir2/R4/Person/synthetic-id',
    'http://127.0.0.1:8080/other-context/patient?q=12345678',
    'http://127.0.0.1:8080/openmrs/ws/rest/v1/p%61tient?q=12345678',
    'http://127.0.0.1:8080/openmrs/ws/rest/v1/patient//?q=12345678',
    'http://127.0.0.1:8080/openmrs/ws/rest/v1/patient;session=secret?q=12345678',
    'https://user:secret@dev.example.test/openmrs/ws/rest/v1/patient?q=12345678',
    'invalid URL with private data',
  ])('blocks unauthorized integration requests (%s)', (url) => {
    expect(classifyReniecContractRequest(url, 'GET', bases)).toBe('blocked');
  });

  it.each([
    'session',
    'patientidentifiertype',
    'personattributetype',
    'concept?q=DNI',
  ])('preserves real metadata reads (%s)', (path) => {
    expect(classifyReniecContractRequest(`${bases[0]}${path}`, 'GET', bases)).toBe('continue');
  });

  it('fulfills both local searches without forwarding and reports only resource labels/counts', async () => {
    const routeInstaller = vi.fn();
    const inspect = await isolateReniecIdentitySearches({ route: routeInstaller } as unknown as Page, bases);
    const handler = routeInstaller.mock.calls[0]?.[1] as (route: Route) => Promise<void>;
    for (const resource of ['patient', 'person']) {
      const fulfill = vi.fn();
      const continueRequest = vi.fn();
      await handler({
        request: () => ({ url: () => `${bases[0]}${resource}?q=12345678`, method: () => 'GET' }),
        fulfill,
        continue: continueRequest,
      } as unknown as Route);
      expect(fulfill).toHaveBeenCalledWith({ status: 200, contentType: 'application/json', body: '{"results":[]}' });
      expect(continueRequest).not.toHaveBeenCalled();
    }
    const abort = vi.fn();
    await handler({
      request: () => ({ url: () => `${bases[0]}patient?q=87654321`, method: () => 'GET' }),
      abort,
    } as unknown as Route);
    expect(abort).toHaveBeenCalledOnce();
    expect(inspect()).toEqual({ searches: ['patient', 'person'], blockedRequests: 1 });
  });
});
