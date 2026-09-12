import path from 'node:path';
import { type APIRequestContext, type Page } from '@playwright/test';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEncounter, getPatient, getVisit } from '../laboratory/commands';
import { laboratoryOrderFixture } from '../laboratory/core/fixture-config';
import { LaboratoryPage } from '../laboratory/pages/laboratory-page';
import laboratoryConfig from '../laboratory/playwright.config';
import { FixtureAuthorizationError } from './e2e-synthetic-fixtures';

describe('laboratory selectors and authentication state', () => {
  it('selects an exact normalized patient cell rather than interpreting the name as a regular expression', () => {
    const cell = {};
    const filter = vi.fn().mockReturnValue({});
    const getByRole = vi.fn((role: string) => (role === 'cell' ? cell : { filter }));
    const laboratory = new LaboratoryPage({ getByRole } as unknown as Page);

    laboratory.getPatientRow(' E2E   Synthetic [A].* ');

    expect(getByRole).toHaveBeenCalledWith('cell', { name: 'E2E Synthetic [A].*', exact: true });
    expect(filter).toHaveBeenCalledWith({ has: cell });
  });

  it('rejects an empty patient name without constructing a broad cell selector', () => {
    const getByRole = vi.fn().mockReturnValue({ filter: vi.fn() });
    const laboratory = new LaboratoryPage({ getByRole } as unknown as Page);
    expect(() => laboratory.getPatientRow('   ')).toThrow(/nonempty synthetic patient name/);
    expect(getByRole).not.toHaveBeenCalledWith('cell', expect.anything());
  });

  it('uses the same absolute authentication-state path as laboratory global setup', () => {
    expect(laboratoryConfig.use?.storageState).toBe(path.resolve(__dirname, '../laboratory/storageState.json'));
    expect(laboratoryConfig.globalSetup).toBe(path.resolve(__dirname, '../laboratory/core/global-setup.ts'));
  });
});

describe('laboratory fixture timestamps and hydration', () => {
  afterEach(() => vi.useRealTimers());

  it.each([
    ['2026-09-12T12:00:11.250Z', '2026-09-12T12:00:11.450Z'],
    ['2026-09-12T12:00:12.400Z', '2026-09-12T12:00:12.400Z'],
    ['2026-09-11T12:00:11.250Z', '2026-09-11T12:01:11.250Z'],
  ])('keeps encounter time within the visit/now interval for start %s', async (startDatetime, expected) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-12T12:00:12.450Z'));
    let recordedTimestamp = '';
    const api = {
      post: vi.fn().mockImplementation(async (_url, { data }) => {
        recordedTimestamp = data.encounterDatetime;
        return { ok: () => true, json: async () => ({}) };
      }),
    } as unknown as APIRequestContext;
    await createEncounter(api, 'synthetic-patient', 'test-provider', {
      uuid: 'synthetic-visit',
      startDatetime,
      location: { uuid: 'test-location' },
      visitType: { uuid: laboratoryOrderFixture.visitTypeUuid },
    });
    expect(new Date(recordedTimestamp).toISOString()).toBe(expected);
  });

  it.each([
    'invalid',
    '2026-09-12T12:00:13.000Z',
  ])('rejects unusable visit time %s before creating an encounter', async (startDatetime) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-12T12:00:12.450Z'));
    const api = { post: vi.fn() } as unknown as APIRequestContext;
    await expect(
      createEncounter(api, 'synthetic-patient', 'test-provider', {
        uuid: 'synthetic-visit',
        startDatetime,
        location: { uuid: 'test-location' },
        visitType: { uuid: laboratoryOrderFixture.visitTypeUuid },
      }),
    ).rejects.toThrow(/valid start no later than now/);
    expect(api.post).not.toHaveBeenCalled();
  });

  for (const read of [getPatient, getVisit]) {
    it.each([
      401, 403,
    ])(`${read.name} preserves authorization failure without reading the response body (%s)`, async (status) => {
      const json = vi.fn();
      const api = {
        get: vi.fn().mockResolvedValue({ status: () => status, ok: () => false, json }),
      } as unknown as APIRequestContext;
      await expect(read(api, 'synthetic-resource')).rejects.toBeInstanceOf(FixtureAuthorizationError);
      expect(api.get).toHaveBeenCalledExactlyOnceWith(
        `${read === getPatient ? 'patient' : 'visit'}/synthetic-resource?v=full`,
        { maxRedirects: 0, maxRetries: 0 },
      );
      expect(json).not.toHaveBeenCalled();
    });
  }
});
