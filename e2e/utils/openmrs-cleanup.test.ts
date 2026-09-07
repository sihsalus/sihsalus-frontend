import { type APIRequestContext, type APIResponse } from '@playwright/test';
import { describe, expect, it, vi } from 'vitest';
import { voidOpenmrsResource, voidOpenmrsResources } from './openmrs-cleanup';

function response(status: number, body: unknown = {}) {
  return {
    json: vi.fn().mockResolvedValue(body),
    ok: vi.fn().mockReturnValue(status >= 200 && status < 300),
    status: vi.fn().mockReturnValue(status),
  } as unknown as APIResponse;
}

function apiWith(deleteResponse: APIResponse, verificationResponse: APIResponse) {
  return {
    delete: vi.fn().mockResolvedValue(deleteResponse),
    get: vi.fn().mockResolvedValue(verificationResponse),
  } as unknown as APIRequestContext;
}

describe('voidOpenmrsResource', () => {
  it('sends a reason and accepts a verified voided resource', async () => {
    const api = apiWith(response(204), response(200, { uuid: 'patient-uuid', voided: true }));

    await voidOpenmrsResource(api, { resource: 'patient', uuid: 'patient-uuid' });

    expect(api.delete).toHaveBeenCalledWith('patient/patient-uuid?reason=Automated%20E2E%20cleanup', { data: {} });
    expect(api.get).toHaveBeenCalledWith('patient/patient-uuid?v=custom%3A(uuid%2Cvoided)');
  });

  it('accepts a resource hidden with 404 after cleanup', async () => {
    const api = apiWith(response(204), response(404));

    await expect(voidOpenmrsResource(api, { resource: 'encounter', uuid: 'encounter-uuid' })).resolves.toBeUndefined();
  });

  it('rejects a successful no-op delete that leaves the resource active', async () => {
    const api = apiWith(response(200), response(200, { uuid: 'patient-uuid', voided: false }));

    await expect(voidOpenmrsResource(api, { resource: 'patient', uuid: 'patient-uuid' })).rejects.toThrow(
      /cleanup failed for patient/,
    );
  });

  it('attempts all cleanup targets before reporting a failure', async () => {
    const api = {
      delete: vi.fn().mockResolvedValue(response(500)),
      get: vi
        .fn()
        .mockResolvedValueOnce(response(200, { voided: false }))
        .mockResolvedValueOnce(response(404)),
    } as unknown as APIRequestContext;

    await expect(
      voidOpenmrsResources(api, [
        { resource: 'order', uuid: 'order-uuid' },
        { resource: 'patient', uuid: 'patient-uuid' },
      ]),
    ).rejects.toThrow(/1 resource/);
    expect(api.delete).toHaveBeenCalledTimes(2);
  });
});
