import type { APIRequestContext } from '@playwright/test';
import { describe, expect, it, vi } from 'vitest';
import { cleanOrthanc } from '../patient-imaging/commands/imaging-operations';
import globalSetup from '../patient-imaging/core/global-setup';

describe('legacy imaging E2E quarantine', () => {
  it('stops before authentication or fixture creation', async () => {
    await expect(globalSetup()).rejects.toThrow('IMAGING_E2E_QUARANTINED');
  });

  it('never lists or deletes candidate studies as a cleanup operation', async () => {
    const request = { get: vi.fn(), post: vi.fn(), delete: vi.fn() };
    await expect(
      cleanOrthanc(
        request as unknown as APIRequestContext,
        request as unknown as APIRequestContext,
        'synthetic-patient',
      ),
    ).rejects.toThrow('IMAGING_E2E_QUARANTINED');
    expect(request.get).not.toHaveBeenCalled();
    expect(request.post).not.toHaveBeenCalled();
    expect(request.delete).not.toHaveBeenCalled();
  });
});
