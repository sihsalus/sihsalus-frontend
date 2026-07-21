import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { type AppointmentArrivalRule, configSchema } from './config-schema';
import { missedAppointmentsPanelConfigSchema } from './scheduled-appointments-config-schema';

const frontendConfig = JSON.parse(readFileSync(resolve(process.cwd(), '../../../config/frontend.json'), 'utf8'));
const appointmentsConfig = frontendConfig['@sihsalus/esm-appointments-app'];
const arrivalRules = appointmentsConfig.appointmentArrivalRules as Array<AppointmentArrivalRule>;

describe('appointments configuration', () => {
  it('requires timed appointments by default', () => {
    expect(configSchema.allowAllDayAppointments._default).toBe(false);
  });

  it('shows missed appointments for the current date', () => {
    expect(missedAppointmentsPanelConfigSchema.status._default).toBe('Missed');
    expect(missedAppointmentsPanelConfigSchema.showForToday._default).toBe(true);
  });

  it('uses the SIHSALUS appointment visit attribute', () => {
    expect(configSchema.appointmentVisitAttributeTypeUuid._default).toBe('193508ab-20c6-5291-9f23-0257335eaabd');
  });

  it('keeps appointment services unrestricted unless gender rules are configured', () => {
    expect(configSchema.appointmentServiceGenderRules._default).toEqual([]);
  });

  it('publishes the canonical contract with one exact rule per active service and location', () => {
    expect(appointmentsConfig.careRoutingContractVersion).toBe('2026-07-18');
    expect(arrivalRules).toHaveLength(13);

    const keys = arrivalRules.map(
      ({ appointmentServiceUuid, appointmentLocationUuid }) => `${appointmentServiceUuid}:${appointmentLocationUuid}`,
    );
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('routes general dentistry through outpatient care without encoding dentistry in VisitType', () => {
    expect(arrivalRules).toContainEqual({
      appointmentServiceUuid: 'b3c2d4e5-f6a7-48d9-93e1-8f7a6b5c4d02',
      appointmentLocationUuid: '35d2234e-129a-4c40-abb2-1ae0b2400001',
      arrivalPolicy: 'queue-optional',
      queueUuid: 'd4e5f6a7-b8c9-40d1-e2f3-a4b5c6d7e8f9',
      queueLocationUuid: '35d2234e-129a-4c40-abb2-1ae0b2400001',
      requiredVisitTypeUuid: 'b1f0e8a1-9c5d-4f0e-8892-81f3140fbc09',
    });
  });

  it.each([
    ['dcaa59d1-64f2-45f5-a930-2ccc0ef37e61', 'b4c5d6e7-f8a9-40b1-c2d3-e4f5a6b7c8d9'],
    ['89bde58b-2161-4095-8e52-0d8b5003012b', 'c5d6e7f8-a9b0-41c2-d3e4-f5a6b7c8d9e0'],
    ['3663f478-80fb-4585-b92f-7f82873198ee', 'd6e7f8a9-b0c1-42d3-e4f5-a6b7c8d9e0f1'],
  ])('defines an explicit queue route for service %s', (serviceUuid, queueUuid) => {
    expect(arrivalRules).toContainEqual(
      expect.objectContaining({
        appointmentServiceUuid: serviceUuid,
        queueUuid,
      }),
    );
  });

  it('keeps direct routes free of queue identifiers', () => {
    const directRules = arrivalRules.filter(({ arrivalPolicy }) => arrivalPolicy === 'direct');
    expect(directRules).toHaveLength(2);
    directRules.forEach((rule) => {
      expect(rule.queueUuid).toBeUndefined();
      expect(rule.queueLocationUuid).toBeUndefined();
      expect(rule.requiredVisitTypeUuid).toBeTruthy();
    });
  });

  it('accepts only structurally complete arrival policies', () => {
    const validate = configSchema.appointmentArrivalRules._elements._validators[0];
    const baseRule = {
      appointmentServiceUuid: 'b3c2d4e5-f6a7-48d9-93e1-8f7a6b5c4d02',
      appointmentLocationUuid: '35d2234e-129a-4c40-abb2-1ae0b2400001',
      requiredVisitTypeUuid: 'b1f0e8a1-9c5d-4f0e-8892-81f3140fbc09',
    };

    expect(validate({ ...baseRule, arrivalPolicy: 'direct' })).toBeUndefined();
    expect(
      validate({
        ...baseRule,
        arrivalPolicy: 'queue-required',
        queueUuid: 'd4e5f6a7-b8c9-40d1-e2f3-a4b5c6d7e8f9',
        queueLocationUuid: '35d2234e-129a-4c40-abb2-1ae0b2400001',
      }),
    ).toBeUndefined();
    expect(validate({ ...baseRule, arrivalPolicy: 'queue-required' })).toMatch(/queue/i);
    expect(
      validate({
        ...baseRule,
        arrivalPolicy: 'direct',
        queueUuid: 'unexpected',
      }),
    ).toMatch(/direct/i);
    expect(validate({ ...baseRule, arrivalPolicy: 'manual' })).toMatch(/policy/i);
  });

  it('uses only active care-setting VisitTypes in frontend eligibility rules', () => {
    const approvedVisitTypeUuids = new Set([
      'b1f0e8a1-9c5d-4f0e-8892-81f3140fbc09',
      '23939157-9af0-457b-8f6c-211eb5459311',
      'e4c8b6d9-7f3a-4e7b-91a2-58b9f6c2d4b5',
      'c2a1d3e2-4b8f-4326-94d9-7f6c9a1b7c98',
    ]);
    const configuredVisitTypeUuids = frontendConfig[
      '@sihsalus/esm-patient-chart-app'
    ].visitTypeEligibilityRules.flatMap(({ visitTypeUuids }: { visitTypeUuids: Array<string> }) => visitTypeUuids);

    expect(configuredVisitTypeUuids.every((uuid) => approvedVisitTypeUuids.has(uuid))).toBe(true);
  });
});
