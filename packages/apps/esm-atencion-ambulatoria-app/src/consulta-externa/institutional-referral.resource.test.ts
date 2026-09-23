import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import {
  buildInstitutionalReferralEncounter,
  type CreateInstitutionalReferralPayload,
  createInstitutionalReferral,
  encodeReferralDestination,
  getRecordedReferralServices,
  parseReferralDestination,
  ReferralServicesError,
} from './institutional-referral.resource';
import type { VisitSummarySource } from './outpatient-visit-summary.resource';

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
  destinationServiceUuid: 'diagnostic-service',
  specialtyUuid: 'surgery',
  patientConditionUuid: 'stable',
  transportModeUuid: 'river',
  reason: '  Evaluación y manejo especializado  ',
  concepts: {
    referralTypeUuid: 'referral-type-question',
    referralReasonUuid: 'referral-reason-question',
    referralDestinationUuid: 'destination-question',
    referralDestinationServiceUuid: 'destination-service-question',
    referralDestinationSpecialtyUuid: 'specialty-question',
    referralDestinationSpecialtyOtherUuid: 'other-specialty-question',
    referralPatientConditionUuid: 'condition-question',
    referralTransportModeUuid: 'transport-question',
  },
};

describe('institutional referral resource', () => {
  beforeEach(() => vi.clearAllMocks());

  it.each([
    '',
    '   ',
  ])('rejects a missing destination service before sending any encounter', async (destinationServiceUuid) => {
    await expect(createInstitutionalReferral({ ...payload, destinationServiceUuid })).rejects.toThrow();
    expect(mockOpenmrsFetch).not.toHaveBeenCalled();
  });

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
        { concept: 'destination-service-question', value: 'diagnostic-service' },
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

describe('recorded referral services', () => {
  const referral = {
    uuid: 'referral',
    encounterType: { uuid: 'referral-type' },
    encounterDatetime: '2030-01-02T10:00:00Z',
    location: { uuid: 'origin-location', display: 'UPSS Emergencia' },
    obs: [
      {
        uuid: 'ups-obs',
        concept: { uuid: 'ups-concept' },
        value: { uuid: 'destination', display: 'Consulta Externa' },
      },
    ],
  };
  const source: VisitSummarySource = {
    uuid: 'visit',
    location: { uuid: 'current-location', display: 'Otra ubicación' },
    encounters: [referral],
  };

  it('uses the selected encounter location and UPS rather than the visit location or specialty', () => {
    expect(getRecordedReferralServices(source, 'referral', 'referral-type', 'ups-concept')).toEqual({
      originService: 'UPSS Emergencia',
      destinationService: 'Consulta Externa',
    });
  });

  it.each([
    'missing',
    'voided',
    'type',
    'duplicate',
    'origin',
    'destination',
    'ambiguous',
    'voided-destination',
  ])('blocks an unverified %s', (scenario) => {
    const candidate = structuredClone(source);
    const encounter = candidate.encounters?.[0];
    if (!encounter?.obs || !candidate.encounters) throw new Error('Invalid synthetic fixture');
    if (scenario === 'missing') candidate.encounters = [];
    if (scenario === 'voided') encounter.voided = true;
    if (scenario === 'type') encounter.encounterType = { uuid: 'another-type' };
    if (scenario === 'duplicate') candidate.encounters.push(structuredClone(encounter));
    if (scenario === 'origin') encounter.location = { uuid: 'no-label', display: ' ' };
    if (scenario === 'destination') encounter.obs = [];
    if (scenario === 'ambiguous') encounter.obs.push(structuredClone(encounter.obs[0]));
    if (scenario === 'voided-destination') encounter.obs[0].voided = true;
    expect(() => getRecordedReferralServices(candidate, 'referral', 'referral-type', 'ups-concept')).toThrow(
      ReferralServicesError,
    );
  });

  it('ignores a voided previous answer and retains the active correction', () => {
    const candidate = structuredClone(source);
    const observations = candidate.encounters?.[0]?.obs;
    if (!observations) throw new Error('Invalid synthetic fixture');
    observations.push({
      uuid: 'old-obs',
      voided: true,
      concept: { uuid: 'ups-concept' },
      value: { uuid: 'old', display: 'Otra UPS' },
    });
    expect(getRecordedReferralServices(candidate, 'referral', 'referral-type', 'ups-concept').destinationService).toBe(
      'Consulta Externa',
    );
  });
});
