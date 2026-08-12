import { type FetchResponse, openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import {
  assertFreshPatientIsAlive,
  DECEASED_PATIENT_OPERATION_BLOCKED,
  PATIENT_VITAL_STATUS_UNAVAILABLE,
} from '@openmrs/esm-patient-common-lib';
import {
  createAttentionEncounter,
  EMERGENCY_ATTENTION_ENCOUNTER_AMBIGUOUS,
  EMERGENCY_ATTENTION_ENCOUNTER_CONFLICT,
  EMERGENCY_ATTENTION_ENCOUNTER_CREATION_UNVERIFIED,
  EMERGENCY_ATTENTION_ENCOUNTER_SEARCH_STALLED,
  EMERGENCY_ATTENTION_ENCOUNTER_TIME_UNAVAILABLE,
  getAttentionEncounterUuid,
} from './attention-form.resource';

vi.mock('@openmrs/esm-patient-common-lib', async () => ({
  ...(await vi.importActual('@openmrs/esm-patient-common-lib')),
  assertFreshPatientIsAlive: vi.fn(),
}));

const mockOpenmrsFetch = vi.mocked(openmrsFetch);
const mockAssertFreshPatientIsAlive = vi.mocked(assertFreshPatientIsAlive);

function response<T>(data: T, date = 'Wed, 12 Aug 2026 16:00:00 GMT') {
  return { data, status: 200, headers: new Headers({ Date: date }) } as FetchResponse<T>;
}

const notFound = () => Object.assign(new Error('404 Not Found'), { status: 404 });

const input = {
  queueEntryUuid: 'ABCDEFAB-1234-1234-1234-ABCDEFABCDEF',
  patientUuid: 'patient-uuid',
  visitUuid: 'visit-uuid',
  encounterTypeUuid: 'encounter-type-uuid',
  locationUuid: 'location-uuid',
  observations: [
    { conceptUuid: 'diagnosis-concept', value: ' Trauma ' },
    { conceptUuid: 'treatment-concept', value: ' Sutura ' },
    { conceptUuid: 'empty-concept', value: ' ' },
  ],
};

const queueEntry = {
  uuid: input.queueEntryUuid,
  patient: { uuid: input.patientUuid },
  visit: { uuid: input.visitUuid },
  startedAt: '2026-08-12T14:00:00.789Z',
  endedAt: null,
};

function persistedEncounter(uuid = getAttentionEncounterUuid(input.queueEntryUuid)) {
  return {
    uuid,
    encounterDatetime: '2026-08-12T15:00:00.000Z',
    voided: false,
    patient: { uuid: input.patientUuid },
    visit: { uuid: input.visitUuid },
    encounterType: { uuid: input.encounterTypeUuid },
    location: { uuid: input.locationUuid },
    obs: [
      { concept: { uuid: 'treatment-concept' }, value: 'Sutura', voided: false },
      { concept: { uuid: 'diagnosis-concept' }, value: 'Trauma', voided: false },
    ],
  };
}

function mockEmptyPreflight() {
  mockOpenmrsFetch
    .mockRejectedValueOnce(notFound())
    .mockResolvedValueOnce(response(queueEntry))
    .mockResolvedValueOnce(response({ results: [] }))
    .mockResolvedValueOnce(response(queueEntry));
}

describe('createAttentionEncounter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAssertFreshPatientIsAlive.mockResolvedValue({ dead: false, deathDate: null, isDeceased: false });
  });

  it('derives one normalized deterministic UUID for the queue entry', () => {
    expect(getAttentionEncounterUuid(input.queueEntryUuid)).toBe('88454f9d-1841-5612-a762-94e4a6efe0d6');
    expect(getAttentionEncounterUuid(`  ${input.queueEntryUuid.toLowerCase()}  `)).toBe(
      '88454f9d-1841-5612-a762-94e4a6efe0d6',
    );
  });

  it('fresh-checks the active queue and living patient, writes the deterministic UUID, and verifies persistence', async () => {
    const persisted = persistedEncounter();
    mockEmptyPreflight();
    mockOpenmrsFetch.mockResolvedValueOnce(response({ uuid: persisted.uuid })).mockResolvedValueOnce(response(persisted));

    await expect(createAttentionEncounter(input)).resolves.toMatchObject({ data: { uuid: persisted.uuid } });

    const postCall = mockOpenmrsFetch.mock.calls.find(([, init]) => init?.method === 'POST');
    expect(postCall).toEqual([
      `${restBaseUrl}/encounter`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: {
          uuid: persisted.uuid,
          patient: input.patientUuid,
          encounterType: input.encounterTypeUuid,
          visit: input.visitUuid,
          location: input.locationUuid,
          obs: [
            { concept: 'diagnosis-concept', value: 'Trauma' },
            { concept: 'treatment-concept', value: 'Sutura' },
          ],
        },
      },
    ]);
    expect(mockAssertFreshPatientIsAlive).toHaveBeenCalledWith(input.patientUuid);
    expect(mockAssertFreshPatientIsAlive.mock.invocationCallOrder[0]).toBeLessThan(
      mockOpenmrsFetch.mock.invocationCallOrder[4],
    );
  });

  it.each([
    ['deceased', DECEASED_PATIENT_OPERATION_BLOCKED],
    ['unavailable', PATIENT_VITAL_STATUS_UNAVAILABLE],
  ])('does not POST when fresh patient status is %s', async (_state, code) => {
    mockEmptyPreflight();
    mockAssertFreshPatientIsAlive.mockRejectedValueOnce(Object.assign(new Error(String(_state)), { code }));

    await expect(createAttentionEncounter(input)).rejects.toMatchObject({ code });
    expect(mockOpenmrsFetch.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false);
  });

  it('does not write when the queue entry ends while legacy reconciliation is running', async () => {
    mockOpenmrsFetch
      .mockRejectedValueOnce(notFound())
      .mockResolvedValueOnce(response(queueEntry))
      .mockResolvedValueOnce(response({ results: [] }))
      .mockResolvedValueOnce(response({ ...queueEntry, endedAt: '2026-08-12T15:05:00.000Z' }));

    await expect(createAttentionEncounter(input)).rejects.toMatchObject({
      code: 'EMERGENCY_QUEUE_ENTRY_ALREADY_ENDED',
    });
    expect(mockAssertFreshPatientIsAlive).not.toHaveBeenCalled();
    expect(mockOpenmrsFetch.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false);
  });

  it('does not write when the fresh queue entry belongs to a different patient', async () => {
    mockOpenmrsFetch
      .mockRejectedValueOnce(notFound())
      .mockResolvedValueOnce(response({ ...queueEntry, patient: { uuid: 'different-patient' } }));

    await expect(createAttentionEncounter(input)).rejects.toMatchObject({
      code: 'EMERGENCY_QUEUE_ENTRY_SUBJECT_MISMATCH',
    });
    expect(mockOpenmrsFetch.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false);
  });

  it.each([
    ['ended', { ...queueEntry, endedAt: '2026-08-12T15:05:00.000Z' }],
    ['transitioned', { ...queueEntry, endedAt: '2026-08-12T15:05:00.000Z', queueComingFrom: { uuid: 'triage' } }],
  ])('does not write for a stale %s queue entry', async (_state, staleEntry) => {
    mockOpenmrsFetch
      .mockRejectedValueOnce(notFound())
      .mockResolvedValueOnce(response(staleEntry))
      .mockResolvedValueOnce(response({ results: [] }))
      .mockResolvedValueOnce(response(staleEntry));

    await expect(createAttentionEncounter(input)).rejects.toMatchObject({ code: 'EMERGENCY_QUEUE_ENTRY_ALREADY_ENDED' });
    expect(mockAssertFreshPatientIsAlive).not.toHaveBeenCalled();
    expect(mockOpenmrsFetch.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false);
  });

  it('reuses the exact deterministic encounter without another clinical write', async () => {
    const persisted = { ...persistedEncounter(), encounterDatetime: '2026-08-12T15:45:00.000Z' };
    mockOpenmrsFetch.mockResolvedValueOnce(response(persisted));

    await expect(createAttentionEncounter(input)).resolves.toMatchObject({ data: { uuid: persisted.uuid } });
    expect(mockOpenmrsFetch).toHaveBeenCalledOnce();
    expect(mockAssertFreshPatientIsAlive).not.toHaveBeenCalled();
  });

  it.each([
    ['different visit', { visit: { uuid: 'different-visit' } }],
    ['invalid datetime', { encounterDatetime: 'not-a-date' }],
    ['different observations', { obs: [{ concept: { uuid: 'diagnosis-concept' }, value: 'Other' }] }],
  ])('rejects a deterministic UUID containing %s', async (_reason, override) => {
    mockOpenmrsFetch.mockResolvedValueOnce(response({ ...persistedEncounter(), ...override }));

    await expect(createAttentionEncounter(input)).rejects.toMatchObject({
      code: EMERGENCY_ATTENTION_ENCOUNTER_CONFLICT,
    });
  });

  it('reconciles a lost POST response when the deterministic encounter persisted', async () => {
    const writeError = new TypeError('response lost');
    const persisted = persistedEncounter();
    mockEmptyPreflight();
    mockOpenmrsFetch.mockRejectedValueOnce(writeError).mockResolvedValueOnce(response(persisted));

    await expect(createAttentionEncounter(input)).resolves.toMatchObject({ data: { uuid: persisted.uuid } });
  });

  it('preserves a lost POST response when no encounter persisted', async () => {
    const writeError = new TypeError('response lost');
    mockEmptyPreflight();
    mockOpenmrsFetch.mockRejectedValueOnce(writeError).mockRejectedValueOnce(notFound());

    await expect(createAttentionEncounter(input)).rejects.toBe(writeError);
  });

  it('rejects a 2xx POST when the encounter did not persist', async () => {
    mockEmptyPreflight();
    mockOpenmrsFetch.mockResolvedValueOnce(response({})).mockRejectedValueOnce(notFound());

    await expect(createAttentionEncounter(input)).rejects.toMatchObject({
      code: EMERGENCY_ATTENTION_ENCOUNTER_CREATION_UNVERIFIED,
    });
  });

  it('accepts a 2xx response without a UUID only after the exact encounter is visible', async () => {
    const persisted = persistedEncounter();
    mockEmptyPreflight();
    mockOpenmrsFetch.mockResolvedValueOnce(response({})).mockResolvedValueOnce(response(persisted));

    await expect(createAttentionEncounter(input)).resolves.toMatchObject({ data: { uuid: persisted.uuid } });
  });

  it('reuses one exact legacy server-generated encounter', async () => {
    const legacy = {
      ...persistedEncounter('legacy-server-uuid'),
      // A refreshed browser cannot know the original pre-deploy attempt time.
      encounterDatetime: '2026-08-12T15:10:00.000Z',
    };
    mockOpenmrsFetch
      .mockRejectedValueOnce(notFound())
      .mockResolvedValueOnce(response(queueEntry))
      .mockResolvedValueOnce(response({ results: [legacy] }));

    await expect(createAttentionEncounter(input)).resolves.toMatchObject({ data: { uuid: legacy.uuid } });
    const legacyUrl = String(mockOpenmrsFetch.mock.calls[2][0]);
    expect(legacyUrl).toContain('fromdate=2026-08-12T14%3A00%3A00.000Z');
    expect(mockOpenmrsFetch.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false);
  });

  it('accepts an encounter in the final millisecond range represented by the HTTP Date second', async () => {
    const legacy = {
      ...persistedEncounter('legacy-subsecond'),
      encounterDatetime: '2026-08-12T16:00:00.500Z',
    };
    mockOpenmrsFetch
      .mockRejectedValueOnce(notFound())
      .mockResolvedValueOnce(response(queueEntry))
      .mockResolvedValueOnce(response({ results: [legacy] }, 'Wed, 12 Aug 2026 16:00:00 GMT'));

    await expect(createAttentionEncounter(input)).resolves.toMatchObject({ data: { uuid: legacy.uuid } });
    expect(mockOpenmrsFetch.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false);
  });

  it.each([
    ['missing', null],
    ['invalid', 'not-a-date'],
    ['before the queue window', '2026-08-12T13:59:59.000Z'],
    ['after the authoritative server second', '2026-08-12T16:00:01.000Z'],
  ])('fails closed when a same-scope legacy encounter time is %s', async (_state, encounterDatetime) => {
    const legacy = { ...persistedEncounter('legacy-bad-time'), encounterDatetime };
    mockOpenmrsFetch
      .mockRejectedValueOnce(notFound())
      .mockResolvedValueOnce(response(queueEntry))
      .mockResolvedValueOnce(response({ results: [legacy] }, 'Wed, 12 Aug 2026 16:00:00 GMT'));

    await expect(createAttentionEncounter(input)).rejects.toMatchObject({
      code: EMERGENCY_ATTENTION_ENCOUNTER_CONFLICT,
    });
    expect(mockOpenmrsFetch.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false);
  });

  it('rejects a different legacy encounter in the same queue window instead of duplicating attention', async () => {
    const other = {
      ...persistedEncounter('other-encounter'),
      obs: [{ concept: { uuid: 'diagnosis-concept' }, value: 'Different care' }],
    };
    mockOpenmrsFetch
      .mockRejectedValueOnce(notFound())
      .mockResolvedValueOnce(response(queueEntry))
      .mockResolvedValueOnce(response({ results: [other] }));

    await expect(createAttentionEncounter(input)).rejects.toMatchObject({
      code: EMERGENCY_ATTENTION_ENCOUNTER_CONFLICT,
    });
    expect(mockOpenmrsFetch.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false);
  });

  it('fails closed when a relevant legacy candidate is returned without authoritative server time', async () => {
    const noDateResponse = { ...response({ results: [persistedEncounter('legacy')] }), headers: new Headers() };
    mockOpenmrsFetch
      .mockRejectedValueOnce(notFound())
      .mockResolvedValueOnce(response(queueEntry))
      .mockResolvedValueOnce(noDateResponse);

    await expect(createAttentionEncounter(input)).rejects.toMatchObject({
      code: EMERGENCY_ATTENTION_ENCOUNTER_TIME_UNAVAILABLE,
    });
    expect(mockOpenmrsFetch.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false);
  });

  it('allows a deterministic create when an exhausted legacy search has no candidates or Date header', async () => {
    const persisted = persistedEncounter();
    mockOpenmrsFetch
      .mockRejectedValueOnce(notFound())
      .mockResolvedValueOnce(response(queueEntry))
      .mockResolvedValueOnce({ ...response({ results: [] }), headers: new Headers() })
      .mockResolvedValueOnce(response(queueEntry))
      .mockResolvedValueOnce(response({ uuid: persisted.uuid }))
      .mockResolvedValueOnce(response(persisted));

    await expect(createAttentionEncounter(input)).resolves.toMatchObject({ data: { uuid: persisted.uuid } });
    expect(mockOpenmrsFetch.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(1);
  });

  it('does not reinterpret an arbitrary error message containing 404 as a missing encounter', async () => {
    const networkError = new TypeError('gateway request 404-ish response was unreadable');
    mockOpenmrsFetch.mockRejectedValueOnce(networkError);

    await expect(createAttentionEncounter(input)).rejects.toBe(networkError);
    expect(mockOpenmrsFetch).toHaveBeenCalledOnce();
  });

  it('rejects multiple identical legacy encounters as ambiguous', async () => {
    mockOpenmrsFetch
      .mockRejectedValueOnce(notFound())
      .mockResolvedValueOnce(response(queueEntry))
      .mockResolvedValueOnce(
        response({ results: [persistedEncounter('legacy-one'), persistedEncounter('legacy-two')] }),
      );

    await expect(createAttentionEncounter(input)).rejects.toMatchObject({
      code: EMERGENCY_ATTENTION_ENCOUNTER_AMBIGUOUS,
    });
  });

  it('exhausts capped legacy pages before reusing the exact encounter', async () => {
    const unrelatedPage = Array.from({ length: 100 }, (_, index) => ({
      ...persistedEncounter(`other-${index}`),
      location: { uuid: 'different-location' },
    }));
    const legacy = persistedEncounter('legacy-page-two');
    mockOpenmrsFetch
      .mockRejectedValueOnce(notFound())
      .mockResolvedValueOnce(response(queueEntry))
      .mockResolvedValueOnce(response({ results: unrelatedPage }))
      .mockResolvedValueOnce(response({ results: [legacy] }));

    await expect(createAttentionEncounter(input)).resolves.toMatchObject({ data: { uuid: legacy.uuid } });
    expect(String(mockOpenmrsFetch.mock.calls[3][0])).toContain('startIndex=100');
  });

  it('fails closed when capped legacy pagination repeats without progress', async () => {
    const repeatedPage = Array.from({ length: 100 }, (_, index) => ({
      ...persistedEncounter(`other-${index}`),
      obs: [{ concept: { uuid: 'diagnosis-concept' }, value: `Other ${index}` }],
    }));
    mockOpenmrsFetch
      .mockRejectedValueOnce(notFound())
      .mockResolvedValueOnce(response(queueEntry))
      .mockResolvedValueOnce(response({ results: repeatedPage }))
      .mockResolvedValueOnce(response({ results: repeatedPage }));

    await expect(createAttentionEncounter(input)).rejects.toMatchObject({
      code: EMERGENCY_ATTENTION_ENCOUNTER_SEARCH_STALLED,
    });
  });
});
