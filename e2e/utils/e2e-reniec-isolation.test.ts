import { type Page, type Route } from '@playwright/test';
import { describe, expect, it, vi } from 'vitest';
import { clinicalActivityHeartbeatUrl } from '../../packages/apps/esm-primary-navigation-app/src/clinical-activity-heartbeat';
import { classifyReniecContractRequest, isolateReniecIdentitySearches } from './e2e-reniec-isolation';

const bases = ['http://127.0.0.1:8080/openmrs/ws/rest/v1/', 'https://dev.example.test/openmrs/ws/rest/v1/'];
const spaBaseUrl = 'http://127.0.0.1:8080/openmrs/spa/';
const heartbeatUrl = new URL(clinicalActivityHeartbeatUrl, spaBaseUrl).href;

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
    const inspect = await isolateReniecIdentitySearches(
      { route: routeInstaller } as unknown as Page,
      bases,
      spaBaseUrl,
    );
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
    expect(inspect()).toEqual({ searches: ['patient', 'person'], blockedRequests: 1, clinicalActivityHeartbeats: 0 });
  });

  it('classifies only the context-free POST at the exact SPA heartbeat URL', () => {
    expect(classifyReniecContractRequest(heartbeatUrl, 'POST', bases, { spaBaseUrl, bodyLength: 0, headers: {} })).toBe(
      'clinicalActivityHeartbeat',
    );
  });

  it.each([
    ['GET', heartbeatUrl],
    ['PUT', heartbeatUrl],
    ['PATCH', heartbeatUrl],
    ['DELETE', heartbeatUrl],
    ['HEAD', heartbeatUrl],
    ['POST', `${heartbeatUrl}?context=synthetic`],
    ['POST', `${heartbeatUrl}?`],
    ['POST', `${heartbeatUrl}#synthetic`],
    ['POST', `${heartbeatUrl}/`],
    ['POST', `${heartbeatUrl}/synthetic-id`],
    ['POST', 'http://127.0.0.1:8080/_sihsalus/%63linical-activity'],
    ['POST', 'http://127.0.0.1:8080/other/../_sihsalus/clinical-activity'],
    ['POST', 'http://127.0.0.1:8080/_sihsalus//clinical-activity'],
    ['POST', 'http://127.0.0.1:8080/_sihsalus/clinical-activity;session=synthetic'],
    ['POST', 'http://127.0.0.1:8081/_sihsalus/clinical-activity'],
    ['POST', 'https://127.0.0.1:8080/_sihsalus/clinical-activity'],
    ['POST', 'https://dev.example.test/_sihsalus/clinical-activity'],
    ['POST', 'https://external.example.test/_sihsalus/clinical-activity'],
    ['POST', 'http://synthetic:secret@127.0.0.1:8080/_sihsalus/clinical-activity'],
    ['POST', `${bases[0]}session`],
  ])('rejects heartbeat deviations: %s %s', (method, url) => {
    expect(classifyReniecContractRequest(url, method, bases, { spaBaseUrl, bodyLength: 0, headers: {} })).toBe(
      'blocked',
    );
  });

  it.each([
    'authorization',
    'Authorization',
    'proxy-authorization',
    'cookie',
    'Cookie',
    'referer',
  ])('rejects heartbeat context in %s, including an empty header', (header) => {
    for (const value of ['', 'synthetic']) {
      expect(
        classifyReniecContractRequest(heartbeatUrl, 'POST', bases, {
          spaBaseUrl,
          bodyLength: 0,
          headers: { [header]: value },
        }),
      ).toBe('blocked');
    }
  });

  it('blocks a body or unavailable heartbeat metadata', () => {
    expect(classifyReniecContractRequest(heartbeatUrl, 'POST', bases)).toBe('blocked');
    expect(classifyReniecContractRequest(heartbeatUrl, 'POST', bases, { spaBaseUrl, bodyLength: 1, headers: {} })).toBe(
      'blocked',
    );
  });

  it('fulfills empty heartbeats locally, reports their count separately and never forwards them', async () => {
    const routeInstaller = vi.fn();
    const inspect = await isolateReniecIdentitySearches(
      { route: routeInstaller } as unknown as Page,
      bases,
      spaBaseUrl,
    );
    const handler = routeInstaller.mock.calls[0]?.[1] as (route: Route) => Promise<void>;
    for (const body of [null, Buffer.from('')]) {
      const fulfill = vi.fn();
      const continueRequest = vi.fn();
      const abort = vi.fn();
      const allHeaders = vi.fn().mockResolvedValue({ accept: '*/*', 'content-length': '0' });
      await handler({
        request: () => ({
          url: () => heartbeatUrl,
          method: () => 'POST',
          postDataBuffer: () => body,
          allHeaders,
          headers: () => {
            throw new Error('Must inspect all headers, including cookies');
          },
        }),
        fulfill,
        continue: continueRequest,
        abort,
      } as unknown as Route);
      expect(allHeaders).toHaveBeenCalledOnce();
      expect(fulfill).toHaveBeenCalledWith({ status: 204 });
      expect(continueRequest).not.toHaveBeenCalled();
      expect(abort).not.toHaveBeenCalled();
    }
    expect(inspect()).toEqual({ searches: [], blockedRequests: 0, clinicalActivityHeartbeats: 2 });
  });

  it.each([
    'cookie',
    'body',
    'headers-unavailable',
  ])('aborts unsafe heartbeat metadata (%s) without exposing it', async (failure) => {
    const routeInstaller = vi.fn();
    const inspect = await isolateReniecIdentitySearches(
      { route: routeInstaller } as unknown as Page,
      bases,
      spaBaseUrl,
    );
    const handler = routeInstaller.mock.calls[0]?.[1] as (route: Route) => Promise<void>;
    const abort = vi.fn();
    const fulfill = vi.fn();
    const continueRequest = vi.fn();
    await handler({
      request: () => ({
        url: () => heartbeatUrl,
        method: () => 'POST',
        postDataBuffer: () => (failure === 'body' ? Buffer.from('synthetic') : null),
        headers: () => ({}),
        allHeaders:
          failure === 'headers-unavailable'
            ? vi.fn().mockRejectedValue(new Error('private transport detail'))
            : vi.fn().mockResolvedValue(failure === 'cookie' ? { cookie: 'synthetic' } : {}),
      }),
      abort,
      fulfill,
      continue: continueRequest,
    } as unknown as Route);
    expect(abort).toHaveBeenCalledOnce();
    expect(fulfill).not.toHaveBeenCalled();
    expect(continueRequest).not.toHaveBeenCalled();
    expect(inspect()).toEqual({ searches: [], blockedRequests: 1, clinicalActivityHeartbeats: 0 });
  });
});
