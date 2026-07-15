import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';

import {
  AttentionEncounterVerificationError,
  createAttentionEncounter,
  isDefinitiveAttentionCreateRejection,
  verifyAttentionEncounter,
} from './attention-form.resource';

const mockOpenmrsFetch = vi.mocked(openmrsFetch);
const expectedIdentity = {
  patientUuid: 'patient-uuid',
  visitUuid: 'visit-uuid',
  encounterTypeUuid: 'encounter-type-uuid',
  locationUuid: 'location-uuid',
};

describe('emergency attention encounter resources', () => {
  beforeEach(() => {
    mockOpenmrsFetch.mockReset();
  });

  it('filters empty observations when creating the encounter', async () => {
    mockOpenmrsFetch.mockResolvedValueOnce({ data: { uuid: 'encounter-uuid' } } as Awaited<
      ReturnType<typeof openmrsFetch>
    >);

    await createAttentionEncounter({
      ...expectedIdentity,
      observations: [
        { conceptUuid: 'diagnosis-uuid', value: ' Neumonía ' },
        { conceptUuid: 'optional-uuid', value: '  ' },
      ],
    });

    expect(mockOpenmrsFetch).toHaveBeenCalledWith(`${restBaseUrl}/encounter`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: expect.objectContaining({
        obs: [{ concept: 'diagnosis-uuid', value: 'Neumonía' }],
      }),
    });
  });

  it('verifies the full encounter identity before queue closure', async () => {
    mockOpenmrsFetch.mockResolvedValueOnce({
      data: {
        uuid: 'encounter-uuid',
        voided: false,
        patient: { uuid: expectedIdentity.patientUuid },
        visit: { uuid: expectedIdentity.visitUuid },
        encounterType: { uuid: expectedIdentity.encounterTypeUuid },
        location: { uuid: expectedIdentity.locationUuid },
      },
    } as Awaited<ReturnType<typeof openmrsFetch>>);

    await expect(verifyAttentionEncounter('encounter-uuid', expectedIdentity)).resolves.toMatchObject({
      data: { uuid: 'encounter-uuid', voided: false },
    });
    expect(mockOpenmrsFetch.mock.calls[0][0]).toContain(`${restBaseUrl}/encounter/encounter-uuid?v=`);
  });

  it.each([
    ['another patient', { patient: { uuid: 'another-patient' } }],
    ['another visit', { visit: { uuid: 'another-visit' } }],
    ['another encounter type', { encounterType: { uuid: 'another-type' } }],
    ['another location', { location: { uuid: 'another-location' } }],
    ['a voided encounter', { voided: true }],
  ])('fails closed for %s', async (_label, override) => {
    mockOpenmrsFetch.mockResolvedValueOnce({
      data: {
        uuid: 'encounter-uuid',
        voided: false,
        patient: { uuid: expectedIdentity.patientUuid },
        visit: { uuid: expectedIdentity.visitUuid },
        encounterType: { uuid: expectedIdentity.encounterTypeUuid },
        location: { uuid: expectedIdentity.locationUuid },
        ...override,
      },
    } as Awaited<ReturnType<typeof openmrsFetch>>);

    await expect(verifyAttentionEncounter('encounter-uuid', expectedIdentity)).rejects.toBeInstanceOf(
      AttentionEncounterVerificationError,
    );
  });

  it('distinguishes explicit request rejections from ambiguous writes', () => {
    expect(isDefinitiveAttentionCreateRejection({ response: { status: 400 } })).toBe(true);
    expect(isDefinitiveAttentionCreateRejection({ status: 403 })).toBe(true);
    expect(isDefinitiveAttentionCreateRejection({ response: { status: 409 } })).toBe(false);
    expect(isDefinitiveAttentionCreateRejection({ response: { status: 500 } })).toBe(false);
    expect(isDefinitiveAttentionCreateRejection(new Error('network timeout'))).toBe(false);
  });
});
