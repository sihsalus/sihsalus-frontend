import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { builtInColumns, configSchema, defaultQueueTable } from './config-schema';

const frontendConfig = JSON.parse(readFileSync(resolve(process.cwd(), '../../../config/frontend.json'), 'utf8'));

describe('service queues configuration defaults', () => {
  it('uses the SIHSALUS visit queue number attribute', () => {
    expect(configSchema.visitQueueNumberAttributeUuid._default).toBe('06a0b8c6-cbdf-4b42-9cbd-871129db8758');
  });

  it('provides operational triage columns in the default worklist', () => {
    expect(builtInColumns).toEqual(expect.arrayContaining(['appointment-time', 'triage-status', 'sis-status']));
    expect(defaultQueueTable.columns).toEqual(
      expect.arrayContaining(['patient-name', 'appointment-time', 'triage-status', 'sis-status', 'actions']),
    );
  });

  it('owns the same outpatient triage contract as appointments', () => {
    const appointmentsConfig = frontendConfig['@sihsalus/esm-appointments-app'];
    const queueConfig = frontendConfig['@sihsalus/esm-service-queues-app'].appointmentTriage;
    const appointmentArrivalRules = appointmentsConfig.appointmentArrivalRules
      .filter(({ requiresTriage }: { requiresTriage?: boolean }) => requiresTriage)
      .map(
        ({
          appointmentServiceUuid,
          appointmentLocationUuid,
          queueUuid,
        }: {
          appointmentServiceUuid: string;
          appointmentLocationUuid: string;
          queueUuid: string;
        }) => ({ appointmentServiceUuid, appointmentLocationUuid, queueUuid }),
      );

    expect(queueConfig).toEqual({
      careRoutingContractVersion: appointmentsConfig.careRoutingContractVersion,
      appointmentVisitAttributeTypeUuid: appointmentsConfig.appointmentVisitAttributeTypeUuid,
      triageRouting: appointmentsConfig.triageRouting,
      appointmentArrivalRules,
    });
  });
});
