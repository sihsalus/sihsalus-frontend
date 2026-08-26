import { configSchema } from './config-schema';

describe('Atencion Ambulatoria configuration', () => {
  it.each([
    ['consultaExternaForm', 'CE-001-CONSULTA EXTERNA'],
    ['anamnesisForm', 'CE-ANAM-001-ANAMNESIS'],
    ['soapNoteForm', 'CE-SOAP-001-NOTA SOAP'],
    ['referralForm', 'CE-REF-001-REFERENCIA-CONTRARREFERENCIA'],
  ] as const)('identifies %s by its stable published name', (configKey, publishedName) => {
    expect(configSchema.formsList._default[configKey]).toBe(publishedName);
  });

  it.each([
    ['labOrdersUuid', 'f0000204-0000-4000-8000-000000000204'],
    ['proceduresUuid', 'f0000206-0000-4000-8000-000000000206'],
    ['prescriptionsUuid', 'f0000215-0000-4000-8000-000000000215'],
    ['referralUuid', 'f0000205-0000-4000-8000-000000000205'],
    ['nextAppointmentUuid', 'f0000004-0000-4000-8000-000000000004'],
  ] as const)('uses the published CE-001 concept for %s', (configKey, conceptUuid) => {
    expect(configSchema.concepts[configKey]._default).toBe(conceptUuid);
  });

  it('keeps the SIS financing warning opt-in so behavior only changes via configuration', () => {
    expect(configSchema.showSisFinancingWarning._default).toBe(false);
  });

  it('uses the published counter-referral return-condition concept', () => {
    expect(configSchema.concepts.counterReferralConditionUuid._default).toBe('f0000175-0000-4000-8000-000000000175');
  });

  it('configures verified institutional referral destinations and transport choices', () => {
    expect(configSchema.referralOriginRenaesCode._default).toBe('00000066');
    expect(configSchema.referralDestinations._default).toEqual([
      expect.objectContaining({ renaesCode: '00000001', name: expect.stringContaining('Hospital Iquitos') }),
      expect.objectContaining({ renaesCode: '00000003', name: expect.stringContaining('Hospital Regional de Loreto') }),
      expect.objectContaining({ renaesCode: '00011409', name: expect.stringContaining('Hospital III Iquitos') }),
    ]);
    expect(configSchema.concepts.referralTransportModeUuid._default).toBe('d37c5028-3820-49fe-98da-d7d05049e601');
    expect([
      configSchema.concepts.referralLandTransportUuid._default,
      configSchema.concepts.referralAirTransportUuid._default,
      configSchema.concepts.referralRiverTransportUuid._default,
    ]).toEqual([
      '844be877-6d20-45e2-876f-dc5de42edd67',
      '2a228c88-7daf-4f60-9e55-c884c9302bd8',
      'd5e04df9-d1dc-431e-bd71-c934ec3e18e2',
    ]);
  });

  it('ships the CE-001 question paths needed to read compatibility-mapped observations', () => {
    expect(configSchema.legacyCe001FieldPaths._default).toEqual({
      labOrders: 'ordenesLaboratorio',
      prescriptions: 'prescripciones',
      referral: 'referencia',
      nextAppointment: 'proximaCita',
    });
  });

  it('scopes generic Visit Notes to the ambulatory visit type', () => {
    expect(configSchema.visitTypes._default.ambulatory).toBe('b1f0e8a1-9c5d-4f0e-8892-81f3140fbc09');
  });

  it('uses the canonical appointment-to-visit link attribute', () => {
    expect(configSchema.appointmentVisitAttributeTypeUuid._default).toBe('193508ab-20c6-5291-9f23-0257335eaabd');
  });
});
