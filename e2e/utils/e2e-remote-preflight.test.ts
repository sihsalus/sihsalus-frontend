import { type APIRequestContext, type APIResponse } from '@playwright/test';
import { describe, expect, it, vi } from 'vitest';
import { type E2EGateConfig } from './e2e-gate-config';
import { validateE2ERemotePreflight } from './e2e-remote-preflight';

const outpatientPatientUuid = '11111111-1111-4111-8111-111111111111';
const appointmentsPatientUuid = '22222222-2222-4222-8222-222222222222';
const locationUuid = '33333333-3333-4333-8333-333333333333';

const config: E2EGateConfig = {
  apiBaseUrl: 'https://gidis-hsc-dev.inf.pucp.edu.pe/openmrs',
  appointmentsPatientUuid,
  locationUuid,
  patientUuid: outpatientPatientUuid,
  spaBaseUrl: 'http://127.0.0.1:8080/openmrs/spa',
  target: 'DEV',
};

function response(status: number, body: unknown = {}) {
  return {
    json: vi.fn().mockResolvedValue(body),
    ok: vi.fn().mockReturnValue(status >= 200 && status < 300),
    status: vi.fn().mockReturnValue(status),
  } as unknown as APIResponse;
}

function apiWith(handler: (url: string) => APIResponse) {
  return {
    dispose: vi.fn().mockResolvedValue(undefined),
    get: vi.fn().mockImplementation(async (url: string) => handler(url)),
  } as unknown as APIRequestContext;
}

function validResponse(url: string): APIResponse {
  if (url.startsWith(`patient/${outpatientPatientUuid}?`)) {
    return response(200, {
      uuid: outpatientPatientUuid,
      display: 'E2E Consulta',
      identifiers: [{ identifier: 'E2E-CE-001' }],
    });
  }
  if (url.startsWith(`patient/${appointmentsPatientUuid}?`)) {
    return response(200, {
      uuid: appointmentsPatientUuid,
      display: 'SYNTHETIC Citas',
      identifiers: [{ identifier: 'SYNTHETIC-CITAS-001' }],
    });
  }
  if (url.startsWith(`location/${locationUuid}?`)) {
    return response(200, { uuid: locationUuid, retired: false });
  }
  if (url.startsWith('session?')) {
    return response(200, { authenticated: true, currentProvider: { uuid: 'provider-uuid', retired: false } });
  }
  if (url.startsWith('visit?')) {
    return response(200, { results: [{ uuid: 'visit-uuid', voided: false, stopDatetime: null }] });
  }

  return response(404);
}

describe('validateE2ERemotePreflight', () => {
  it('accepts active synthetic fixtures, location, provider, and exactly one active visit', async () => {
    const api = apiWith(validResponse);

    await validateE2ERemotePreflight(config, { createApiContext: async () => api });

    expect(api.get).toHaveBeenCalledTimes(5);
    expect(api.dispose).toHaveBeenCalledOnce();
  });

  it('rejects an ordinary patient identity without exposing it in the error', async () => {
    const api = apiWith((url) => {
      if (url.startsWith(`patient/${outpatientPatientUuid}?`)) {
        return response(200, {
          uuid: outpatientPatientUuid,
          display: 'Identidad que no debe aparecer en logs',
          identifiers: [{ identifier: '12345678' }],
        });
      }
      return validResponse(url);
    });

    const validation = validateE2ERemotePreflight(config, { createApiContext: async () => api });
    await expect(validation).rejects.toThrow(/must carry an E2E or SYNTHETIC marker/);
    await expect(validation).rejects.not.toThrow(/Identidad que no debe aparecer/);
    expect(api.dispose).toHaveBeenCalledOnce();
  });

  it('rejects a fixture without exactly one active outpatient visit', async () => {
    const api = apiWith((url) => (url.startsWith('visit?') ? response(200, { results: [] }) : validResponse(url)));

    await expect(validateE2ERemotePreflight(config, { createApiContext: async () => api })).rejects.toThrow(
      /exactly one active prepared visit/,
    );
    expect(api.dispose).toHaveBeenCalledOnce();
  });

  it('lets the laboratory suite omit the prepared outpatient visit check', async () => {
    const api = apiWith(validResponse);

    await validateE2ERemotePreflight(config, {
      createApiContext: async () => api,
      requirePreparedOutpatientVisit: false,
    });

    expect(api.get).toHaveBeenCalledTimes(4);
    expect(api.get).not.toHaveBeenCalledWith(expect.stringMatching(/^visit\?/));
    expect(api.dispose).toHaveBeenCalledOnce();
  });
});
