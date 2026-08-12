import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import {
  assertFreshPatientIsAlive,
  DECEASED_PATIENT_OPERATION_BLOCKED,
  PATIENT_VITAL_STATUS_UNAVAILABLE,
} from '@openmrs/esm-patient-common-lib';
import { createAttentionEncounter } from './attention-form.resource';

vi.mock('@openmrs/esm-patient-common-lib', async () => ({
  ...(await vi.importActual('@openmrs/esm-patient-common-lib')),
  assertFreshPatientIsAlive: vi.fn(),
}));

const mockOpenmrsFetch = vi.mocked(openmrsFetch);
const mockAssertFreshPatientIsAlive = vi.mocked(assertFreshPatientIsAlive);

const input = {
  patientUuid: 'patient-uuid',
  visitUuid: 'visit-uuid',
  encounterTypeUuid: 'encounter-type-uuid',
  locationUuid: 'location-uuid',
  observations: [
    { conceptUuid: 'diagnosis-concept', value: ' Trauma ' },
    { conceptUuid: 'empty-concept', value: ' ' },
  ],
};

describe('createAttentionEncounter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAssertFreshPatientIsAlive.mockResolvedValue({ dead: false, deathDate: null, isDeceased: false });
    mockOpenmrsFetch.mockResolvedValue({ data: { uuid: 'encounter-uuid' } } as never);
  });

  it('fresh-checks a living patient immediately before writing the encounter', async () => {
    await createAttentionEncounter(input);

    expect(mockAssertFreshPatientIsAlive).toHaveBeenCalledWith(input.patientUuid);
    expect(mockOpenmrsFetch).toHaveBeenCalledWith(`${restBaseUrl}/encounter`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: {
        patient: input.patientUuid,
        encounterType: input.encounterTypeUuid,
        visit: input.visitUuid,
        location: input.locationUuid,
        obs: [{ concept: 'diagnosis-concept', value: 'Trauma' }],
      },
    });
    expect(mockAssertFreshPatientIsAlive.mock.invocationCallOrder[0]).toBeLessThan(
      mockOpenmrsFetch.mock.invocationCallOrder[0],
    );
  });

  it.each([
    ['deceased', DECEASED_PATIENT_OPERATION_BLOCKED],
    ['unavailable', PATIENT_VITAL_STATUS_UNAVAILABLE],
  ])('does not POST when fresh patient status is %s', async (_state, code) => {
    mockAssertFreshPatientIsAlive.mockRejectedValueOnce(Object.assign(new Error(String(_state)), { code }));

    await expect(createAttentionEncounter(input)).rejects.toMatchObject({ code });

    expect(mockOpenmrsFetch).not.toHaveBeenCalled();
  });
});
