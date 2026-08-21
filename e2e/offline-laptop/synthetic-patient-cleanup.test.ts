import type { APIRequestContext, APIResponse } from '@playwright/test';
import { describe, expect, it, vi } from 'vitest';

import { recoverSyntheticPatientUuid } from './synthetic-patient-cleanup';

function createApi(results: Array<unknown>, status = 200) {
  const response = {
    json: vi.fn(async () => ({ results })),
    ok: vi.fn(() => status >= 200 && status < 300),
    status: vi.fn(() => status),
  } as unknown as APIResponse;
  const api = {
    get: vi.fn(async () => response),
  } as unknown as APIRequestContext;

  return { api, response };
}

const marker = {
  familyName: 'DEVOfflineGate123',
  identifier: 'SYN-123',
  identifierTypeUuid: '11111111-1111-4111-8111-111111111111',
};

const matchingPatient = {
  identifiers: [
    {
      identifier: marker.identifier,
      identifierType: { uuid: marker.identifierTypeUuid },
    },
  ],
  person: {
    names: [{ familyName: marker.familyName, givenName: 'SYNTHETIC' }],
  },
  uuid: '22222222-2222-4222-8222-222222222222',
  voided: false,
};

describe('recoverSyntheticPatientUuid', () => {
  it('returns only the patient matching the generated identifier, type, and synthetic name', async () => {
    const { api } = createApi([
      {
        ...matchingPatient,
        person: {
          names: [{ familyName: 'NotSynthetic', givenName: 'SYNTHETIC' }],
        },
      },
      matchingPatient,
    ]);

    await expect(recoverSyntheticPatientUuid(api, marker)).resolves.toBe(matchingPatient.uuid);
  });

  it('returns undefined when the create request did not commit a patient', async () => {
    const { api } = createApi([]);

    await expect(recoverSyntheticPatientUuid(api, marker)).resolves.toBeUndefined();
  });

  it('fails closed instead of choosing between multiple matching patients', async () => {
    const { api } = createApi([matchingPatient, { ...matchingPatient, uuid: '33333333-3333-4333-8333-333333333333' }]);

    await expect(recoverSyntheticPatientUuid(api, marker)).rejects.toThrow(/ambiguous/);
  });

  it('surfaces a failed recovery request without exposing the identifier', async () => {
    const { api } = createApi([], 503);

    await expect(recoverSyntheticPatientUuid(api, marker)).rejects.toThrow(
      'Could not recover the synthetic patient for cleanup (503).',
    );
    await expect(recoverSyntheticPatientUuid(api, marker)).rejects.not.toThrow(marker.identifier);
  });
});
