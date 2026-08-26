import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import {
  buildInstitutionalReferralEncounter,
  createInstitutionalReferral,
  encodeReferralDestination,
  parseReferralDestination,
  type CreateInstitutionalReferralPayload,
} from './institutional-referral.resource';

const mockOpenmrsFetch = vi.mocked(openmrsFetch);

const payload: CreateInstitutionalReferralPayload = {
  patientUuid: 'patient-uuid',
  visitUuid: 'visit-uuid',
  locationUuid: 'location-uuid',
  providerUuid: 'provider-uuid',
  encounterTypeUuid: 'referral-encounter-type',
  encounterRoleUuid: 'clinician-role',
  destination: { renaesCode: '00000003', name: 'Hospital Regional de Loreto' },
  referralTypeUuid: 'urgent-referral',
  specialtyUuid: 'surgery',
  patientConditionUuid: 'stable',
  transportModeUuid: 'river',
  reason: '  Evaluación y manejo especializado  ',
  concepts: {
    referralTypeUuid: 'referral-type-question',
    referralReasonUuid: 'referral-reason-question',
    referralDestinationUuid: 'destination-question',
    referralDestinationSpecialtyUuid: 'specialty-question',
    referralDestinationSpecialtyOtherUuid: 'other-specialty-question',
    referralPatientConditionUuid: 'condition-question',
    referralTransportModeUuid: 'transport-question',
  },
};

describe('institutional referral resource', () => {
  beforeEach(() => vi.clearAllMocks());

  it('preserves the RENIPRESS code with the selected destination', () => {
    expect(encodeReferralDestination(payload.destination)).toBe('00000003 | Hospital Regional de Loreto');
    expect(parseReferralDestination('00000003 | Hospital Regional de Loreto')).toEqual({
      renaesCode: '00000003',
      name: 'Hospital Regional de Loreto',
    });
    expect(parseReferralDestination('Establecimiento histórico')).toEqual({
      renaesCode: null,
      name: 'Establecimiento histórico',
    });
  });

  it('builds one referral encounter containing only referral-owned observations', () => {
    expect(buildInstitutionalReferralEncounter(payload)).toEqual({
      patient: 'patient-uuid',
      visit: 'visit-uuid',
      encounterType: 'referral-encounter-type',
      location: 'location-uuid',
      encounterProviders: [{ provider: 'provider-uuid', encounterRole: 'clinician-role' }],
      obs: [
        { concept: 'referral-type-question', value: 'urgent-referral' },
        { concept: 'destination-question', value: '00000003 | Hospital Regional de Loreto' },
        { concept: 'specialty-question', value: 'surgery' },
        { concept: 'condition-question', value: 'stable' },
        { concept: 'transport-question', value: 'river' },
        { concept: 'referral-reason-question', value: 'Evaluación y manejo especializado' },
      ],
    });
  });

  it('persists the encounter atomically and requires a returned uuid', async () => {
    mockOpenmrsFetch.mockResolvedValue({ ok: true, status: 201, data: { uuid: 'referral-uuid' } } as never);

    await expect(createInstitutionalReferral(payload)).resolves.toEqual({ uuid: 'referral-uuid' });
    expect(mockOpenmrsFetch).toHaveBeenCalledWith(`${restBaseUrl}/encounter`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: undefined,
      body: buildInstitutionalReferralEncounter(payload),
    });

    mockOpenmrsFetch.mockResolvedValue({ ok: true, status: 200, data: {} } as never);
    await expect(createInstitutionalReferral(payload)).rejects.toThrow('No se pudo crear la referencia institucional');
  });
});
