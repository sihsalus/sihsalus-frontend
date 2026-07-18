import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { configSchema } from './config-schema';

const frontendConfig = JSON.parse(
  readFileSync(resolve(process.cwd(), '../../../config/frontend.json'), 'utf8'),
);

describe('appointments configuration defaults', () => {
  it('requires timed appointments by default', () => {
    expect(configSchema.allowAllDayAppointments._default).toBe(false);
  });

  it('uses the SIHSALUS appointment visit attribute', () => {
    expect(configSchema.appointmentVisitAttributeTypeUuid._default).toBe('193508ab-20c6-5291-9f23-0257335eaabd');
  });

  it('keeps appointment services unrestricted unless gender rules are configured', () => {
    expect(configSchema.appointmentServiceGenderRules._default).toEqual([]);
  });

  it('routes dental appointments to the shared outpatient queue with the dental visit type', () => {
    const mappings = frontendConfig['@sihsalus/esm-appointments-app'].appointmentQueueMappings;

    expect(mappings).toContainEqual({
      appointmentServiceUuid: 'b3c2d4e5-f6a7-48d9-93e1-8f7a6b5c4d02',
      appointmentLocationUuid: '35d2234e-129a-4c40-abb2-1ae0b2400001',
      queueUuid: 'd4e5f6a7-b8c9-40d1-e2f3-a4b5c6d7e8f9',
      queueLocationUuid: '35d2234e-129a-4c40-abb2-1ae0b2400001',
      requiredVisitTypeUuid: 'ae40aab4-c57d-4bb1-a27e-2cacc24dd07f',
    });
  });
});
