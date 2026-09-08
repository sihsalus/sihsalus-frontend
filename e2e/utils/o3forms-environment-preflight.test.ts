import { EventEmitter } from 'node:events';
import { readFileSync } from 'node:fs';
import type { IncomingMessage } from 'node:http';
import type { request } from 'node:https';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  createMetadataClient,
  devOrigin,
  formNames,
  inventoryEnvironment,
  readPreflightConfig,
  safeErrorCode,
  validateMetadataUrl,
} from '../scripts/o3forms-environment-preflight.mjs';

const environment = {
  O3FORMS_READONLY_PREFLIGHT: 'true',
  E2E_GATE_TARGET: 'DEV',
  O3FORMS_PREFLIGHT_ORIGIN: devOrigin,
  E2E_IGNORE_HTTPS_ERRORS: 'true',
  E2E_USER_ADMIN_USERNAME: 'SYNTHETIC_TEST_ACCOUNT',
  E2E_USER_ADMIN_PASSWORD: 'local-double-only',
};
const uuid = (digit: number) => `${String(digit).repeat(8)}-1111-4111-8111-111111111111`;
const sessionUrl = `${devOrigin}/openmrs/ws/rest/v1/session?v=custom:(authenticated,user:(retired,privileges:(name,retired)))`;
const technical = { uuid: uuid(1), display: 'SYNTHETIC_METADATA', retired: false };

function fixture(value: string): unknown {
  const url = new URL(value);
  if (url.pathname.endsWith('/session'))
    return {
      authenticated: true,
      user: { retired: false, username: 'DO_NOT_LOG', privileges: [{ name: 'Get Forms', retired: false }] },
      sessionId: 'DO_NOT_LOG',
      person: { display: 'DO_NOT_LOG' },
    };
  if (url.pathname.endsWith('/build-info.json')) return { gitSha: 'a'.repeat(40), private: 'DO_NOT_LOG' };
  if (url.pathname.endsWith('/module')) return { results: [{ uuid: 'o3forms', version: '2.3.0', started: true }] };
  if (url.pathname.endsWith('/form'))
    return {
      results: [
        { uuid: uuid(2), name: url.searchParams.get('q'), published: true, retired: false, encounterType: technical },
      ],
    };
  if (url.pathname.endsWith('/identifiersource')) return { results: [{ ...technical, identifierType: technical }] };
  return { results: [technical] };
}

function transport(status: number, body: string) {
  const outgoing = Object.assign(new EventEmitter(), {
    setTimeout: vi.fn(),
    destroy: vi.fn(),
    end: vi.fn(),
  });
  const response = Object.assign(new EventEmitter(), { statusCode: status, resume: vi.fn(), destroy: vi.fn() });
  const mock = vi.fn((_url: URL, _options: unknown, callback: (message: IncomingMessage) => void) => {
    outgoing.end.mockImplementation(() => {
      callback(response as unknown as IncomingMessage);
      response.emit('data', Buffer.from(body));
      response.emit('end');
    });
    return outgoing;
  });
  return { mock, outgoing, response, request: mock as unknown as typeof request };
}

describe('O3 Forms DEV-only read-only environment preflight', () => {
  it('requires a fresh exact-label event for each reviewed PR head instead of running on later pushes', () => {
    const workflow = readFileSync(resolve('.github/workflows/o3forms-readonly-preflight.yml'), 'utf8');
    expect(workflow).toMatch(/types: \[labeled\]/);
    expect(workflow).not.toMatch(/\bsynchronize\b|\bworkflow_dispatch\b|\bpull_request_target\b/);
    expect(workflow).toContain("github.event.label.name == 'o3forms-dev-preflight'");
    expect(workflow).not.toContain('contains(github.event.pull_request.labels');
    expect(workflow).toContain('github.event.pull_request.head.repo.full_name == github.repository');
    expect(workflow).toMatch(/ref: \$\{\{ github\.event\.pull_request\.head\.sha \}\}/);
    expect(workflow).toContain('persist-credentials: false');
  });

  it('requires explicit DEV origin, TLS decision, opt-in and test credentials', () => {
    for (const key of Object.keys(environment)) {
      const missing: NodeJS.ProcessEnv = { ...environment };
      delete missing[key];
      expect(() => readPreflightConfig(missing)).toThrow('CONFIGURATION');
    }
    expect(readPreflightConfig(environment).allowSelfSigned).toBe(true);
    expect(readPreflightConfig({ ...environment, E2E_IGNORE_HTTPS_ERRORS: 'false' }).allowSelfSigned).toBe(false);
  });

  it.each([
    'https://gidis-hsc-qlty.inf.pucp.edu.pe',
    'http://gidis-hsc-dev.inf.pucp.edu.pe',
    'https://gidis-hsc-dev.inf.pucp.edu.pe.attacker.test',
    'https://192.0.2.10',
  ])('rejects target overrides before creating a client: %s', (origin) => {
    expect(() => readPreflightConfig({ ...environment, O3FORMS_PREFLIGHT_ORIGIN: origin })).toThrow('CONFIGURATION');
  });

  it.each([
    '/openmrs/ws/rest/v1/patient',
    '/openmrs/ws/rest/v1/person',
    '/openmrs/ws/rest/v1/provider',
    '/openmrs/ws/rest/v1/idgen/identifiersource/111/identifier',
    '/openmrs/ws/rest/v1/encounter',
  ])('rejects clinical or identifier-allocation URLs: %s', (path) => {
    expect(() => validateMetadataUrl(`${devOrigin}${path}`, readPreflightConfig(environment))).toThrow(
      'FORBIDDEN_REQUEST',
    );
  });

  it('rejects duplicate query keys, redirects, embedded credentials and non-DEV TLS bypass', () => {
    const config = readPreflightConfig(environment);
    for (const value of [
      `${sessionUrl}&v=full`,
      `${sessionUrl}&patient=${uuid(1)}`,
      sessionUrl.replace(devOrigin, 'https://outside.example.test'),
      sessionUrl.replace('https://', 'https://user:secret@'),
    ])
      expect(() => validateMetadataUrl(value, config)).toThrow('FORBIDDEN_REQUEST');
    expect(() => validateMetadataUrl(sessionUrl, { ...config, origin: 'https://outside.example.test' })).toThrow(
      'FORBIDDEN_REQUEST',
    );
  });

  it('uses GET only, in-memory authorization, and TLS bypass only after fixed-host validation', async () => {
    const fake = transport(200, '{"authenticated":true}');
    const client = createMetadataClient(readPreflightConfig(environment), fake.request);
    await client.get(sessionUrl);
    expect(fake.mock).toHaveBeenCalledOnce();
    expect(fake.mock.mock.calls[0]?.[1]).toMatchObject({ method: 'GET', rejectUnauthorized: false });
    expect(Object.keys(client)).toEqual(['get']);
    expect(fake.outgoing.end).toHaveBeenCalledWith();
  });

  it.each([301, 302, 401, 403, 500])('does not follow redirects or expose HTTP %s response bodies', async (status) => {
    const fake = transport(status, 'DO_NOT_LOG_RAW_ERROR_OR_COOKIE');
    const client = createMetadataClient(readPreflightConfig(environment), fake.request);
    await expect(client.get(sessionUrl)).rejects.not.toThrow('DO_NOT_LOG');
    expect(fake.mock).toHaveBeenCalledOnce();
    expect(fake.response.resume).toHaveBeenCalledOnce();
  });

  it('rejects malformed JSON and oversized responses without exposing their content', async () => {
    for (const body of ['DO_NOT_LOG_INVALID_JSON', 'x'.repeat(2 * 1024 * 1024 + 1)]) {
      const fake = transport(200, body);
      await expect(
        createMetadataClient(readPreflightConfig(environment), fake.request).get(sessionUrl),
      ).rejects.not.toThrow('DO_NOT_LOG');
    }
    expect(safeErrorCode(new Error('DO_NOT_LOG_UNEXPECTED_ERROR'))).toBe('UNEXPECTED_FAILURE');
  });

  it('inventories only allowlisted metadata and does not demand the patch already be installed', async () => {
    const get = vi.fn(async (value: string) => fixture(value));
    const report = await inventoryEnvironment({ get });
    expect(report.o3forms).toEqual({ version: '2.3.0', started: true });
    expect(report.clinicalValidation).toBe('NOT_RUN');
    expect(JSON.stringify(report)).not.toContain('DO_NOT_LOG');
    expect(report.session).toEqual({ authenticated: true, privileges: ['Get Forms'] });
    expect(report.forms).toHaveLength(2);
    for (const [value] of get.mock.calls) validateMetadataUrl(value, readPreflightConfig(environment));
    expect(
      get.mock.calls
        .filter(([value]) => new URL(value).pathname.endsWith('/form'))
        .map(([value]) => new URL(value).searchParams.get('q')),
    ).toEqual(formNames);
  });

  it('stops every dependent request after an unauthenticated session', async () => {
    const get = vi.fn(async () => ({ authenticated: false, user: { display: 'DO_NOT_LOG' } }));
    await expect(inventoryEnvironment({ get })).rejects.toThrow('UNAUTHENTICATED');
    expect(get).toHaveBeenCalledOnce();
  });

  it.each([401, 403])('stops every dependent request after HTTP %s', async (status) => {
    const fake = transport(status, 'DO_NOT_LOG');
    await expect(
      inventoryEnvironment(createMetadataClient(readPreflightConfig(environment), fake.request)),
    ).rejects.toThrow(`HTTP_${status}`);
    expect(fake.mock).toHaveBeenCalledOnce();
  });

  it('does not treat missing started metadata as proof that a module is started', async () => {
    const report = await inventoryEnvironment({
      get: async (value) =>
        value.includes('/module?') ? { results: [{ uuid: 'o3forms', version: '2.3.0' }] } : fixture(value),
    });
    expect(report.o3forms).toEqual({ version: '2.3.0', started: null });
  });

  it('paginates metadata using its own allowlisted URL instead of a server-supplied next URL', async () => {
    const get = vi.fn(async (value: string) => {
      const url = new URL(value);
      if (url.pathname.endsWith('/visittype') && url.searchParams.get('startIndex') === '0') {
        return { results: [technical], links: [{ rel: 'next', uri: 'https://outside.example.test/patient' }] };
      }
      return fixture(value);
    });
    const report = await inventoryEnvironment({ get });
    expect(report.visitTypes).toHaveLength(2);
    expect(get.mock.calls.every(([value]) => new URL(value).origin === devOrigin)).toBe(true);
  });

  it('rejects incomplete pagination without performing unbounded reads', async () => {
    const get = vi.fn(async (value: string) =>
      value.includes('/visittype?') ? { results: [], links: [{ rel: 'next' }] } : fixture(value),
    );
    await expect(inventoryEnvironment({ get })).rejects.toThrow('INCOMPLETE_METADATA');
    expect(get.mock.calls.filter(([value]) => value.includes('/visittype?'))).toHaveLength(1);
  });
});
