import { openmrsFetch } from '@openmrs/esm-framework';
import { defaultUnknownEncounterRoleUuid } from './ampath-form-immunization-config';
import {
  addEncounterProvider,
  ensureImmunizationEncounterProvider,
  getRepairableEncounterUuid,
  getUnknownEncounterRoleUuid,
  hasEncounterProviderWithRole,
  pickLatestEncounter,
} from './immunization-encounter-provider.resource';

const mockOpenmrsFetch = vi.mocked(openmrsFetch);
const roleUuid = defaultUnknownEncounterRoleUuid;
const encounterTypeUuid = '29c02aff-9a93-46c9-bf6f-48b552fcb1fa';
const encounterUuid = '0d1c9f3a-5a42-4a33-9c6e-1b2f6d8c9e01';

type FetchResponse = Awaited<ReturnType<typeof openmrsFetch>>;

function mockGetEncounters(results: Array<unknown>) {
  mockOpenmrsFetch.mockResolvedValueOnce({ data: { results } } as FetchResponse);
}

describe('immunization encounter provider resource', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('falls back to the default Unknown encounter role', () => {
    expect(getUnknownEncounterRoleUuid(undefined)).toBe(roleUuid);
    expect(getUnknownEncounterRoleUuid({ unknownEncounterRoleUuid: 'configured-role' })).toBe('configured-role');
  });

  it('extracts the encounter uuid from the FHIR2 Unknown role diagnostics', () => {
    const error = {
      status: 400,
      responseBody: {
        resourceType: 'OperationOutcome',
        issue: [
          {
            diagnostics: `The Immunization resource is required to be attached to an OpenMRS encounter involving a single encounter provider with the role 'Unknown'. This is not the case for immunization 'obs-uuid' attached to encounter '${encounterUuid}'.`,
          },
        ],
      },
    };

    expect(getRepairableEncounterUuid(error)).toBe(encounterUuid);
    expect(getRepairableEncounterUuid({ status: 500, responseBody: { issue: [{ diagnostics: 'other' }] } })).toBeNull();
    expect(getRepairableEncounterUuid(undefined)).toBeNull();
  });

  it('extracts the encounter uuid whatever the name of the administering encounter role', () => {
    const error = {
      status: 400,
      responseBody: {
        resourceType: 'OperationOutcome',
        issue: [
          {
            diagnostics: `The Immunization resource is required to be attached to an OpenMRS encounter involving a single encounter provider with the role 'Desconocido'. This is not the case for immunization 'obs-uuid' attached to encounter '${encounterUuid}'.`,
          },
        ],
      },
    };

    expect(getRepairableEncounterUuid(error)).toBe(encounterUuid);
    expect(
      getRepairableEncounterUuid({
        status: 400,
        responseBody: { issue: [{ diagnostics: `Something else attached to encounter '${encounterUuid}'.` }] },
      }),
    ).toBeNull();
  });

  it('only counts non-voided providers with the Unknown role', () => {
    expect(
      hasEncounterProviderWithRole(
        { uuid: encounterUuid, encounterProviders: [{ uuid: 'ep', encounterRole: { uuid: roleUuid } }] },
        roleUuid,
      ),
    ).toBe(true);
    expect(
      hasEncounterProviderWithRole(
        {
          uuid: encounterUuid,
          encounterProviders: [
            { uuid: 'ep-1', voided: true, encounterRole: { uuid: roleUuid } },
            { uuid: 'ep-2', encounterRole: { uuid: 'clinician-role' } },
          ],
        },
        roleUuid,
      ),
    ).toBe(false);
    expect(hasEncounterProviderWithRole({ uuid: encounterUuid }, roleUuid)).toBe(false);
  });

  it('picks the most recent encounter by encounterDatetime like FHIR2', () => {
    const latest = pickLatestEncounter([
      { uuid: 'older', encounterDatetime: '2026-10-01T10:00:00.000+0000' },
      { uuid: 'newest', encounterDatetime: '2026-10-16T09:00:00.000+0000' },
      { uuid: 'middle', encounterDatetime: '2026-10-10T10:00:00.000+0000' },
    ]);

    expect(latest?.uuid).toBe('newest');
    expect(pickLatestEncounter([])).toBeNull();
    expect(pickLatestEncounter(undefined)).toBeNull();
  });

  it('posts the provider with the Unknown role to the encounter', async () => {
    mockOpenmrsFetch.mockResolvedValueOnce({ data: {} } as FetchResponse);

    await addEncounterProvider(encounterUuid, 'provider-uuid', roleUuid);

    expect(mockOpenmrsFetch).toHaveBeenCalledWith(
      `/ws/rest/v1/encounter/${encounterUuid}/encounterprovider`,
      expect.objectContaining({
        method: 'POST',
        body: { provider: 'provider-uuid', encounterRole: roleUuid },
      }),
    );
  });

  it('adds the role to the latest vaccination encounter of the visit when it is missing', async () => {
    mockGetEncounters([
      {
        uuid: 'older',
        encounterDatetime: '2026-10-01T10:00:00.000+0000',
        visit: { uuid: 'visit-uuid' },
        encounterProviders: [],
      },
      {
        uuid: encounterUuid,
        encounterDatetime: '2026-10-16T09:00:00.000+0000',
        visit: { uuid: 'visit-uuid' },
        encounterProviders: [],
      },
    ]);
    mockOpenmrsFetch.mockResolvedValueOnce({ data: {} } as FetchResponse);

    const repaired = await ensureImmunizationEncounterProvider({
      patientUuid: 'patient-uuid',
      visitUuid: 'visit-uuid',
      encounterTypeUuid,
      providerUuid: 'provider-uuid',
      encounterRoleUuid: roleUuid,
    });

    expect(repaired).toBe(encounterUuid);
    expect(mockOpenmrsFetch).toHaveBeenNthCalledWith(
      1,
      `/ws/rest/v1/encounter?patient=patient-uuid&visit=visit-uuid&encounterType=${encounterTypeUuid}&v=custom:(uuid,encounterDatetime,visit:(uuid),encounterProviders:(uuid,voided,provider:(uuid),encounterRole:(uuid)))`,
      expect.objectContaining({}),
    );
    expect(mockOpenmrsFetch).toHaveBeenLastCalledWith(
      `/ws/rest/v1/encounter/${encounterUuid}/encounterprovider`,
      expect.objectContaining({ method: 'POST', body: { provider: 'provider-uuid', encounterRole: roleUuid } }),
    );
  });

  it('ignores encounters of other visits returned by the server', async () => {
    mockGetEncounters([
      { uuid: 'other-visit', encounterDatetime: '2026-10-16T09:00:00.000+0000', visit: { uuid: 'other-visit-uuid' } },
      { uuid: encounterUuid, encounterDatetime: '2026-10-01T10:00:00.000+0000', visit: { uuid: 'visit-uuid' } },
    ]);
    mockOpenmrsFetch.mockResolvedValueOnce({ data: {} } as FetchResponse);

    const repaired = await ensureImmunizationEncounterProvider({
      patientUuid: 'patient-uuid',
      visitUuid: 'visit-uuid',
      encounterTypeUuid,
      providerUuid: 'provider-uuid',
      encounterRoleUuid: roleUuid,
    });

    expect(repaired).toBe(encounterUuid);
    expect(mockOpenmrsFetch).toHaveBeenLastCalledWith(
      `/ws/rest/v1/encounter/${encounterUuid}/encounterprovider`,
      expect.objectContaining({ method: 'POST' }),
    );

    mockGetEncounters([
      { uuid: 'other-visit', encounterDatetime: '2026-10-16T09:00:00.000+0000', visit: { uuid: 'other-visit-uuid' } },
    ]);
    await expect(
      ensureImmunizationEncounterProvider({
        patientUuid: 'patient-uuid',
        visitUuid: 'visit-uuid',
        encounterTypeUuid,
        providerUuid: 'provider-uuid',
        encounterRoleUuid: roleUuid,
      }),
    ).resolves.toBeNull();
    expect(mockOpenmrsFetch).toHaveBeenCalledTimes(3);
  });

  it('ignores encounters without a visit even when they are more recent', async () => {
    mockGetEncounters([
      { uuid: 'no-visit', encounterDatetime: '2026-10-16T09:00:00.000+0000', visit: null, encounterProviders: [] },
      {
        uuid: encounterUuid,
        encounterDatetime: '2026-10-01T10:00:00.000+0000',
        visit: { uuid: 'visit-uuid' },
        encounterProviders: [],
      },
    ]);
    mockOpenmrsFetch.mockResolvedValueOnce({ data: {} } as FetchResponse);

    const repaired = await ensureImmunizationEncounterProvider({
      patientUuid: 'patient-uuid',
      visitUuid: 'visit-uuid',
      encounterTypeUuid,
      providerUuid: 'provider-uuid',
      encounterRoleUuid: roleUuid,
    });

    expect(repaired).toBe(encounterUuid);
    expect(mockOpenmrsFetch).toHaveBeenCalledTimes(2);
    expect(mockOpenmrsFetch).toHaveBeenLastCalledWith(
      `/ws/rest/v1/encounter/${encounterUuid}/encounterprovider`,
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('does nothing when the latest encounter already has the role or there is no encounter', async () => {
    mockGetEncounters([
      {
        uuid: encounterUuid,
        encounterDatetime: '2026-10-16T09:00:00.000+0000',
        visit: { uuid: 'visit-uuid' },
        encounterProviders: [{ uuid: 'ep', provider: { uuid: 'someone' }, encounterRole: { uuid: roleUuid } }],
      },
    ]);

    await expect(
      ensureImmunizationEncounterProvider({
        patientUuid: 'patient-uuid',
        visitUuid: 'visit-uuid',
        encounterTypeUuid,
        providerUuid: 'provider-uuid',
        encounterRoleUuid: roleUuid,
      }),
    ).resolves.toBeNull();
    expect(mockOpenmrsFetch).toHaveBeenCalledTimes(1);

    mockGetEncounters([]);
    await expect(
      ensureImmunizationEncounterProvider({
        patientUuid: 'patient-uuid',
        visitUuid: 'visit-uuid',
        encounterTypeUuid,
        providerUuid: 'provider-uuid',
        encounterRoleUuid: roleUuid,
      }),
    ).resolves.toBeNull();
    expect(mockOpenmrsFetch).toHaveBeenCalledTimes(2);
  });

  it('skips the lookup without a patient, a visit or a provider', async () => {
    await expect(
      ensureImmunizationEncounterProvider({
        patientUuid: '',
        visitUuid: 'visit-uuid',
        encounterTypeUuid,
        providerUuid: 'provider-uuid',
        encounterRoleUuid: roleUuid,
      }),
    ).resolves.toBeNull();
    await expect(
      ensureImmunizationEncounterProvider({
        patientUuid: 'patient-uuid',
        visitUuid: '',
        encounterTypeUuid,
        providerUuid: 'provider-uuid',
        encounterRoleUuid: roleUuid,
      }),
    ).resolves.toBeNull();
    await expect(
      ensureImmunizationEncounterProvider({
        patientUuid: 'patient-uuid',
        visitUuid: 'visit-uuid',
        encounterTypeUuid,
        providerUuid: undefined,
        encounterRoleUuid: roleUuid,
      }),
    ).resolves.toBeNull();
    expect(mockOpenmrsFetch).not.toHaveBeenCalled();
  });
});
