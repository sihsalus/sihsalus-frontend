import { type APIRequestContext, type APIResponse } from '@playwright/test';
import { describe, expect, it, vi } from 'vitest';
import { laboratoryOrderFixture } from '../laboratory/core/fixture-config';
import { type E2EGateConfig } from './e2e-gate-config';
import {
  validateE2EBaseRemotePreflight,
  validateE2ELaboratoryRemotePreflight,
  validateE2ERemotePreflight,
} from './e2e-remote-preflight';

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
    delete: vi.fn(),
    dispose: vi.fn().mockResolvedValue(undefined),
    get: vi.fn().mockImplementation(async (url: string) => handler(url)),
    patch: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
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

const concept = {
  uuid: laboratoryOrderFixture.conceptUuid,
  retired: false,
  conceptClass: { uuid: 'test-class-uuid', name: 'Test' },
  datatype: { name: 'Numeric' },
};
const orderType = {
  uuid: laboratoryOrderFixture.orderTypeUuid,
  retired: false,
  javaClassName: 'org.openmrs.TestOrder',
  conceptClasses: [{ uuid: concept.conceptClass.uuid }],
};

function validLaboratoryResponse(url: string) {
  if (url.startsWith('provider/provider-uuid?')) return response(200, { uuid: 'provider-uuid', retired: false });
  if (url.startsWith(`visittype/${laboratoryOrderFixture.visitTypeUuid}?`)) {
    return response(200, { uuid: laboratoryOrderFixture.visitTypeUuid, retired: false });
  }
  if (url.startsWith(`concept/${laboratoryOrderFixture.conceptUuid}?`)) return response(200, concept);
  if (url.startsWith(`ordertype/${laboratoryOrderFixture.orderTypeUuid}?`)) return response(200, orderType);
  return validResponse(url);
}

describe('validateE2ERemotePreflight', () => {
  it('validates a provider and location before patient fixtures are provisioned', async () => {
    const api = apiWith(validResponse);
    const { appointmentsPatientUuid: _appointments, patientUuid: _patient, ...baseConfig } = config;

    await validateE2EBaseRemotePreflight(baseConfig, { createApiContext: async () => api });

    expect(api.get).toHaveBeenCalledTimes(2);
    expect(api.get).toHaveBeenCalledWith(expect.stringMatching(/^location\//));
    expect(api.get).toHaveBeenCalledWith(expect.stringMatching(/^session\?/));
    expect(api.dispose).toHaveBeenCalledOnce();
  });

  it('accepts active synthetic fixtures, location, provider, and exactly one active visit', async () => {
    const api = apiWith(validResponse);

    await validateE2ERemotePreflight(config, { createApiContext: async () => api });

    expect(api.get).toHaveBeenCalledTimes(5);
    expect(api.dispose).toHaveBeenCalledOnce();
  });

  it.each([401, 403])('stops before patient reads after an HTTP %s base-preflight failure', async (status) => {
    const api = apiWith((url) => (url.startsWith('session?') ? response(status) : validResponse(url)));
    await expect(validateE2ERemotePreflight(config, { createApiContext: async () => api })).rejects.toThrow(
      /account session could not be loaded/,
    );
    expect(api.get).not.toHaveBeenCalledWith(expect.stringMatching(/^patient\//));
    expect(api.dispose).toHaveBeenCalledOnce();
  });

  it.each([
    { authenticated: false, currentProvider: { uuid: 'provider-uuid' } },
    { authenticated: true, currentProvider: null },
    { authenticated: true, currentProvider: { uuid: 'provider-uuid', retired: true } },
  ])('rejects an unauthenticated session or unavailable provider in the base gate', async (session) => {
    const api = apiWith((url) => (url.startsWith('session?') ? response(200, session) : validResponse(url)));
    await expect(validateE2EBaseRemotePreflight(config, { createApiContext: async () => api })).rejects.toThrow(
      /active clinical provider/,
    );
    expect(api.dispose).toHaveBeenCalledOnce();
  });

  it.each([
    {},
    { results: [{ uuid: 'visit-uuid', voided: false, stopDatetime: null }], links: [{ rel: 'next' }] },
  ])('rejects an incomplete visit listing instead of assuming uniqueness', async (visits) => {
    const api = apiWith((url) => (url.startsWith('visit?') ? response(200, visits) : validResponse(url)));
    await expect(validateE2ERemotePreflight(config, { createApiContext: async () => api })).rejects.toThrow(
      /visit listing is incomplete/,
    );
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

describe('validateE2ELaboratoryRemotePreflight', () => {
  it('requires SIHSALUS AST/TGO, Atención Ambulatoria and a compatible active TestOrder using only metadata GETs', async () => {
    const api = apiWith(validLaboratoryResponse);
    await validateE2ELaboratoryRemotePreflight(config, {
      createApiContext: async () => api,
    });

    expect(laboratoryOrderFixture.conceptUuid).toBe('18730e4e-0a5f-40cf-8c19-474276f5e9d7');
    expect(laboratoryOrderFixture.visitTypeUuid).toBe('b1f0e8a1-9c5d-4f0e-8892-81f3140fbc09');
    expect(api.get).toHaveBeenCalledTimes(6);
    expect(vi.mocked(api.get).mock.calls.map(([url]) => url.split('?')[0])).toEqual([
      `location/${locationUuid}`,
      'session',
      'provider/provider-uuid',
      `visittype/${laboratoryOrderFixture.visitTypeUuid}`,
      `concept/${laboratoryOrderFixture.conceptUuid}`,
      `ordertype/${laboratoryOrderFixture.orderTypeUuid}`,
    ]);
    for (const method of [api.post, api.put, api.patch, api.delete]) expect(method).not.toHaveBeenCalled();
    expect(api.dispose).toHaveBeenCalledOnce();
  });

  it.each([
    401, 403, 404, 500,
  ])('rejects an unreadable visit type with HTTP %s without discovering a substitute', async (status) => {
    const unavailable = response(status, { private: 'DO_NOT_LOG_RESPONSE_BODY' });
    const api = apiWith((url) => (url.startsWith('visittype/') ? unavailable : validLaboratoryResponse(url)));

    await expect(validateE2ELaboratoryRemotePreflight(config, { createApiContext: async () => api })).rejects.toThrow(
      `LABORATORY_VISIT_TYPE_HTTP_${status}`,
    );
    expect(unavailable.json).not.toHaveBeenCalled();
    expect(api.get).not.toHaveBeenCalledWith(expect.stringMatching(/^visittype\?|^concept\/|^patient\//));
    for (const method of [api.post, api.put, api.patch, api.delete]) expect(method).not.toHaveBeenCalled();
    expect(api.dispose).toHaveBeenCalledOnce();
  });

  it.each([
    null,
    {},
    { uuid: 'different-visit-type', retired: false },
    { uuid: laboratoryOrderFixture.visitTypeUuid, retired: true },
    { uuid: laboratoryOrderFixture.visitTypeUuid },
    { uuid: laboratoryOrderFixture.visitTypeUuid, retired: 'false' },
  ])('rejects inactive, incomplete or mismatched visit metadata before fixtures', async (body) => {
    const api = apiWith((url) => (url.startsWith('visittype/') ? response(200, body) : validLaboratoryResponse(url)));

    await expect(validateE2ELaboratoryRemotePreflight(config, { createApiContext: async () => api })).rejects.toThrow(
      'LABORATORY_VISIT_TYPE_INACTIVE_OR_MISMATCH',
    );
    expect(api.get).not.toHaveBeenCalledWith(expect.stringMatching(/^visittype\?|^concept\/|^patient\//));
    for (const method of [api.post, api.put, api.patch, api.delete]) expect(method).not.toHaveBeenCalled();
    expect(api.dispose).toHaveBeenCalledOnce();
  });

  it.each([
    401, 403, 404, 500,
  ])('blocks an unavailable concept with HTTP %s before any fixture or fallback', async (status) => {
    const failedResponse = response(status, {
      private: 'DO_NOT_LOG_RESPONSE_BODY',
    });
    const api = apiWith((url) => (url.startsWith('concept/') ? failedResponse : validLaboratoryResponse(url)));
    await expect(
      validateE2ELaboratoryRemotePreflight(config, {
        createApiContext: async () => api,
      }),
    ).rejects.toThrow(`LABORATORY_CONCEPT_HTTP_${status}`);
    expect(failedResponse.json).not.toHaveBeenCalled();
    expect(api.get).not.toHaveBeenCalledWith(expect.stringMatching(/^ordertype\/|^patient\/|^concept\?/));
    for (const method of [api.post, api.put, api.patch, api.delete]) expect(method).not.toHaveBeenCalled();
    expect(api.dispose).toHaveBeenCalledOnce();
  });

  it.each([
    null,
    {},
    { ...concept, uuid: 'different-concept-uuid' },
    { ...concept, retired: true },
    { ...concept, retired: undefined },
    { ...concept, retired: 'false' },
    { ...concept, conceptClass: { uuid: 'test-class-uuid', name: 'Drug' } },
    { ...concept, conceptClass: { name: 'Test' } },
    { ...concept, datatype: { name: 'Coded' } },
    { ...concept, datatype: undefined },
  ])('rejects inactive, incomplete or incompatible concept metadata', async (body) => {
    const api = apiWith((url) => (url.startsWith('concept/') ? response(200, body) : validLaboratoryResponse(url)));
    await expect(
      validateE2ELaboratoryRemotePreflight(config, {
        createApiContext: async () => api,
      }),
    ).rejects.toThrow('LABORATORY_CONCEPT_INACTIVE_OR_INCOMPATIBLE');
    expect(api.get).not.toHaveBeenCalledWith(expect.stringMatching(/^ordertype\//));
    expect(api.dispose).toHaveBeenCalledOnce();
  });

  it.each([
    null,
    {},
    { ...orderType, uuid: 'different-order-type-uuid' },
    { ...orderType, retired: true },
    { ...orderType, retired: undefined },
    { ...orderType, retired: 'false' },
    { ...orderType, javaClassName: 'org.openmrs.DrugOrder' },
    { ...orderType, conceptClasses: undefined },
    { ...orderType, conceptClasses: [] },
    { ...orderType, conceptClasses: [{ uuid: 'other-class-uuid' }] },
    { ...orderType, conceptClasses: [null] },
  ])('rejects an inactive or incompatible order type', async (body) => {
    const api = apiWith((url) => (url.startsWith('ordertype/') ? response(200, body) : validLaboratoryResponse(url)));
    await expect(
      validateE2ELaboratoryRemotePreflight(config, {
        createApiContext: async () => api,
      }),
    ).rejects.toThrow('LABORATORY_ORDER_TYPE_INACTIVE_OR_INCOMPATIBLE');
    expect(api.dispose).toHaveBeenCalledOnce();
  });

  it.each([401, 403, 404])('rejects an unreadable order type with HTTP %s', async (status) => {
    const api = apiWith((url) => (url.startsWith('ordertype/') ? response(status) : validLaboratoryResponse(url)));
    await expect(
      validateE2ELaboratoryRemotePreflight(config, {
        createApiContext: async () => api,
      }),
    ).rejects.toThrow(`LABORATORY_ORDER_TYPE_HTTP_${status}`);
    expect(api.dispose).toHaveBeenCalledOnce();
  });

  it('verifies an active provider resource when the session exposes only its UUID', async () => {
    const api = apiWith((url) =>
      url.startsWith('session?')
        ? response(200, {
            authenticated: true,
            currentProvider: { uuid: 'provider-uuid' },
          })
        : validLaboratoryResponse(url),
    );
    await validateE2ELaboratoryRemotePreflight(config, {
      createApiContext: async () => api,
    });
    expect(api.get).toHaveBeenCalledWith('provider/provider-uuid?v=custom:(uuid,retired)');
  });

  it.each([
    null,
    { uuid: 'provider-uuid' },
    { uuid: 'provider-uuid', retired: true },
    { uuid: 'provider-uuid', retired: 'false' },
    { uuid: 'different-provider-uuid', retired: false },
  ])('does not treat an incomplete session reference as proof of an active provider', async (body) => {
    const api = apiWith((url) => (url.startsWith('provider/') ? response(200, body) : validLaboratoryResponse(url)));
    await expect(
      validateE2ELaboratoryRemotePreflight(config, {
        createApiContext: async () => api,
      }),
    ).rejects.toThrow('LABORATORY_PROVIDER_INACTIVE_OR_MISMATCH');
    expect(api.get).not.toHaveBeenCalledWith(expect.stringMatching(/^concept\//));
    expect(api.dispose).toHaveBeenCalledOnce();
  });

  it('requires explicit active location metadata before reading laboratory resources', async () => {
    const api = apiWith((url) =>
      url.startsWith('location/') ? response(200, { uuid: locationUuid }) : validLaboratoryResponse(url),
    );
    await expect(
      validateE2ELaboratoryRemotePreflight(config, {
        createApiContext: async () => api,
      }),
    ).rejects.toThrow('LABORATORY_LOCATION_INACTIVE_OR_UNKNOWN');
    expect(api.get).not.toHaveBeenCalledWith(expect.stringMatching(/^provider\/|^concept\//));
    expect(api.dispose).toHaveBeenCalledOnce();
  });

  it.each(['transport', 'json'])('sanitizes unexpected %s failures and releases the API context', async (failure) => {
    const api = apiWith((url) => {
      if (!url.startsWith('concept/')) return validLaboratoryResponse(url);
      if (failure === 'transport') throw new Error('DO_NOT_LOG_REQUEST_DETAILS');
      const malformed = response(200);
      vi.mocked(malformed.json).mockRejectedValue(new Error('DO_NOT_LOG_RESPONSE_BODY'));
      return malformed;
    });
    const validation = validateE2ELaboratoryRemotePreflight(config, {
      createApiContext: async () => api,
    });
    await expect(validation).rejects.toThrow(
      failure === 'transport' ? 'LABORATORY_CONCEPT_REQUEST_FAILED' : 'LABORATORY_CONCEPT_JSON_FAILED',
    );
    await expect(validation).rejects.not.toThrow('DO_NOT_LOG');
    expect(api.dispose).toHaveBeenCalledOnce();
  });

  it('sanitizes context creation failures before any metadata request', async () => {
    const createApiContext = vi.fn().mockRejectedValue(new Error('DO_NOT_LOG_CONTEXT_DETAILS'));
    const validation = validateE2ELaboratoryRemotePreflight(config, { createApiContext });
    await expect(validation).rejects.toThrow('LABORATORY_CONTEXT_CREATE_FAILED');
    await expect(validation).rejects.not.toThrow('DO_NOT_LOG');
    expect(createApiContext).toHaveBeenCalledOnce();
  });

  it.each([
    false,
    true,
  ])('reports context disposal failure without losing a prior metadata failure: %s', async (missingConcept) => {
    const api = apiWith((url) =>
      missingConcept && url.startsWith('concept/') ? response(404) : validLaboratoryResponse(url),
    );
    vi.mocked(api.dispose).mockRejectedValue(new Error('DO_NOT_LOG_DISPOSAL_DETAILS'));
    const validation = validateE2ELaboratoryRemotePreflight(config, { createApiContext: async () => api });

    await expect(validation).rejects.toThrow(
      missingConcept
        ? 'LABORATORY_CONCEPT_HTTP_404; LABORATORY_CONTEXT_DISPOSE_FAILED'
        : 'LABORATORY_CONTEXT_DISPOSE_FAILED',
    );
    await expect(validation).rejects.not.toThrow('DO_NOT_LOG');
    expect(api.dispose).toHaveBeenCalledOnce();
  });
});

const preflights = [
  { scope: 'BASE', validate: validateE2EBaseRemotePreflight, resources: ['location', 'session'] },
  { scope: 'CLINICAL', validate: validateE2ERemotePreflight, resources: ['location', 'session', 'patient', 'visit'] },
  {
    scope: 'LABORATORY',
    validate: validateE2ELaboratoryRemotePreflight,
    resources: ['location', 'session', 'provider', 'visittype', 'concept', 'ordertype'],
  },
] as const;

function expectPrivateErrorDiscarded(error: Error) {
  expect(error).toBeInstanceOf(Error);
  expect(`${error.message}\n${error.stack}`).not.toMatch(/DO_NOT_LOG|secret|clinical-id|https:\/\//);
  expect(error).not.toHaveProperty('cause');
  expect(Object.keys(error)).toEqual([]);
}

describe.each(preflights)('$scope shared preflight error boundary', ({ scope, validate, resources }) => {
  it.each([
    new Error('DO_NOT_LOG_CONTEXT_DETAILS', { cause: new Error('secret') }),
    'DO_NOT_LOG_CONTEXT_STRING',
    { private: 'DO_NOT_LOG_CONTEXT_OBJECT' },
    null,
  ])('sanitizes rejected context creation without accessing external error properties', async (failure) => {
    const createApiContext = vi.fn().mockRejectedValue(failure);
    const error = await validate(config, { createApiContext }).catch((error: Error) => error);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe(`${scope}_CONTEXT_CREATE_FAILED`);
    expectPrivateErrorDiscarded(error as Error);
    expect(createApiContext).toHaveBeenCalledOnce();
  });

  for (const resource of resources) {
    const stage =
      resource === 'ordertype' ? 'ORDER_TYPE' : resource === 'visittype' ? 'VISIT_TYPE' : resource.toUpperCase();
    it.each(['request', 'json'])(
      'sanitizes ' + resource + ' %s failures and preserves a simultaneous disposal failure',
      async (operation) => {
        for (const disposalFails of [false, true]) {
          const sensitiveFailure = new Error(
            'DO_NOT_LOG https://example.test/patient/clinical-id?secret=value Authorization: secret response body',
            { cause: new Error('DO_NOT_LOG_NESTED_CAUSE') },
          );
          const api = apiWith((url) => {
            if (!url.startsWith(`${resource}${resource === 'session' || resource === 'visit' ? '?' : '/'}`)) {
              return validLaboratoryResponse(url);
            }
            if (operation === 'request') throw sensitiveFailure;
            const result = response(200);
            vi.mocked(result.json).mockRejectedValue(sensitiveFailure);
            return result;
          });
          if (disposalFails) vi.mocked(api.dispose).mockRejectedValue(new Error('DO_NOT_LOG_DISPOSE'));
          const error = await validate(config, { createApiContext: async () => api }).catch((error: Error) => error);
          expect((error as Error).message).toBe(
            `${scope}_${stage}_${operation.toUpperCase()}_FAILED${disposalFails ? `; ${scope}_CONTEXT_DISPOSE_FAILED` : ''}`,
          );
          expectPrivateErrorDiscarded(error as Error);
          expect(api.dispose).toHaveBeenCalledOnce();
          for (const method of [api.post, api.put, api.patch, api.delete]) expect(method).not.toHaveBeenCalled();
        }
      },
    );

    it.each([null, 'DO_NOT_LOG_RESPONSE_BODY', []])(
      'rejects malformed ' + resource + ' JSON values without copying their contents',
      async (body) => {
        const api = apiWith((url) =>
          url.startsWith(`${resource}${resource === 'session' || resource === 'visit' ? '?' : '/'}`)
            ? response(200, body)
            : validLaboratoryResponse(url),
        );
        const error = await validate(config, { createApiContext: async () => api }).catch((error: Error) => error);
        expectPrivateErrorDiscarded(error as Error);
        expect(api.dispose).toHaveBeenCalledOnce();
      },
    );
  }

  it('reports a disposal-only failure after successful checks', async () => {
    const api = apiWith(validLaboratoryResponse);
    vi.mocked(api.dispose).mockRejectedValue(new Error('DO_NOT_LOG_DISPOSE_DETAILS'));
    const error = await validate(config, { createApiContext: async () => api }).catch((error: Error) => error);
    expect((error as Error).message).toBe(`${scope}_CONTEXT_DISPOSE_FAILED`);
    expectPrivateErrorDiscarded(error as Error);
    expect(api.dispose).toHaveBeenCalledOnce();
  });

  it('retains a known validation error when disposal also fails', async () => {
    const api = apiWith((url) => (url.startsWith('session?') ? response(403) : validLaboratoryResponse(url)));
    vi.mocked(api.dispose).mockRejectedValue(new Error('DO_NOT_LOG_DISPOSE_DETAILS'));
    const error = await validate(config, { createApiContext: async () => api }).catch((error: Error) => error);
    expect((error as Error).message).toBe(
      `Clinical E2E remote preflight failed: the configured account session could not be loaded (403).; ${scope}_CONTEXT_DISPOSE_FAILED`,
    );
    expectPrivateErrorDiscarded(error as Error);
    expect(api.get).toHaveBeenCalledTimes(2);
    expect(api.dispose).toHaveBeenCalledOnce();
  });

  it.each([
    'LABORATORY_DO_NOT_LOG_SECRET_404',
    'Clinical E2E remote preflight failed: DO_NOT_LOG_PRIVATE_BODY',
  ])('does not trust external messages resembling an internal safe code or clinical prefix', async (message) => {
    const api = apiWith(() => {
      throw new Error(message, { cause: new Error('DO_NOT_LOG_CAUSE') });
    });
    const error = await validate(config, { createApiContext: async () => api }).catch((error: Error) => error);
    expect((error as Error).message).toBe(`${scope}_LOCATION_REQUEST_FAILED`);
    expectPrivateErrorDiscarded(error as Error);
    expect(api.dispose).toHaveBeenCalledOnce();
  });

  it('does not interpolate a malformed HTTP status value', async () => {
    const failed = response(503);
    vi.mocked(failed.status).mockReturnValue('DO_NOT_LOG_STATUS' as unknown as number);
    const api = apiWith(() => failed);
    const error = await validate(config, { createApiContext: async () => api }).catch((error: Error) => error);
    expect((error as Error).message).toBe(`${scope}_LOCATION_RESPONSE_INVALID`);
    expectPrivateErrorDiscarded(error as Error);
    expect(failed.json).not.toHaveBeenCalled();
    expect(api.dispose).toHaveBeenCalledOnce();
  });
});

describe('malformed clinical response collections', () => {
  const validVisit = { uuid: 'visit-uuid', voided: false, stopDatetime: null };
  it('preserves a valid unique visit when optional pagination links are null', async () => {
    const api = apiWith((url) =>
      url.startsWith('visit?')
        ? response(200, { results: [{ uuid: 'visit-uuid', voided: false, stopDatetime: null }], links: null })
        : validResponse(url),
    );
    await validateE2ERemotePreflight(config, { createApiContext: async () => api });
    expect(api.dispose).toHaveBeenCalledOnce();
  });

  it('counts only the active visit when complete voided and ended visits are also returned', async () => {
    const api = apiWith((url) =>
      url.startsWith('visit?')
        ? response(200, {
            results: [
              validVisit,
              { ...validVisit, uuid: 'voided-visit', voided: true },
              { ...validVisit, uuid: 'ended-visit', stopDatetime: '2026-09-11T00:00:00.000+0000' },
            ],
            links: [{ rel: 'prev' }],
          })
        : validResponse(url),
    );
    await validateE2ERemotePreflight(config, { createApiContext: async () => api });
    expect(api.dispose).toHaveBeenCalledOnce();
  });

  it.each([
    {},
    { voided: false, stopDatetime: null },
    { ...validVisit, uuid: null },
    { ...validVisit, uuid: '' },
    { ...validVisit, voided: undefined },
    { ...validVisit, voided: null },
    { ...validVisit, voided: 'false' },
    { ...validVisit, stopDatetime: undefined },
    { ...validVisit, stopDatetime: false },
    { ...validVisit, stopDatetime: 0 },
    { ...validVisit, stopDatetime: {} },
    { ...validVisit, stopDatetime: '' },
    { ...validVisit, stopDatetime: 'DO_NOT_LOG_DATE' },
  ])('rejects visits missing the requested identity or state fields before counting active visits', async (visit) => {
    const api = apiWith((url) =>
      url.startsWith('visit?') ? response(200, { results: [validVisit, visit] }) : validResponse(url),
    );
    const error = await validateE2ERemotePreflight(config, { createApiContext: async () => api }).catch(
      (error: Error) => error,
    );
    expect((error as Error).message).toBe(
      'Clinical E2E remote preflight failed: outpatient visit listing is incomplete.',
    );
    expectPrivateErrorDiscarded(error as Error);
    expect(api.dispose).toHaveBeenCalledOnce();
  });

  it.each([
    { results: [null] },
    { results: ['DO_NOT_LOG_VISIT'] },
    { results: [[]] },
    { results: [{}] },
    { results: [validVisit], links: 'DO_NOT_LOG_LINKS' },
    { results: [validVisit], links: [null] },
    { results: [validVisit], links: ['DO_NOT_LOG_LINK'] },
    { results: [validVisit], links: [{}] },
    { results: [validVisit], links: [{ rel: null }] },
    { results: [validVisit], links: [{ rel: 7 }] },
    { results: [validVisit], links: [{ rel: '' }] },
    { results: [validVisit], links: [{ rel: ' ' }] },
  ])('rejects malformed visit entries and pagination without exposing the body', async (body) => {
    const api = apiWith((url) => (url.startsWith('visit?') ? response(200, body) : validResponse(url)));
    const error = await validateE2ERemotePreflight(config, { createApiContext: async () => api }).catch(
      (error: Error) => error,
    );
    expect((error as Error).message).toBe(
      'Clinical E2E remote preflight failed: outpatient visit listing is incomplete.',
    );
    expectPrivateErrorDiscarded(error as Error);
    expect(api.dispose).toHaveBeenCalledOnce();
  });

  it.each([
    { identifiers: 'DO_NOT_LOG_IDENTIFIERS' },
    { identifiers: [null] },
    { person: { names: 'DO_NOT_LOG_NAMES' } },
    { person: { names: [null] } },
  ])('sanitizes malformed patient markers without copying nested identity data', async (identity) => {
    const api = apiWith((url) =>
      url.startsWith(`patient/${outpatientPatientUuid}?`)
        ? response(200, { uuid: outpatientPatientUuid, ...identity })
        : validResponse(url),
    );
    const error = await validateE2ERemotePreflight(config, { createApiContext: async () => api }).catch(
      (error: Error) => error,
    );
    expect((error as Error).message).toBe('CLINICAL_PATIENT_RESPONSE_INVALID');
    expectPrivateErrorDiscarded(error as Error);
    expect(api.dispose).toHaveBeenCalledOnce();
  });
});
