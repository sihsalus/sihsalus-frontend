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
