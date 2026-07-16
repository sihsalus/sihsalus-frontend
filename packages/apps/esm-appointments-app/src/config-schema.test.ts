import { configSchema } from './config-schema';

describe('appointments configuration defaults', () => {
  it('requires timed appointments by default', () => {
    expect(configSchema.allowAllDayAppointments._default).toBe(false);
  });

  it('uses the SIHSALUS appointment visit attribute', () => {
    expect(configSchema.appointmentVisitAttributeTypeUuid._default).toBe('193508ab-20c6-5291-9f23-0257335eaabd');
  });
});
