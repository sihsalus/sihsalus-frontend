import { expectedAppointmentsPanelConfigSchema } from './scheduled-appointments-config-schema';

describe('scheduled appointments panel config', () => {
  it('keeps still-scheduled appointments reachable when viewing past dates', () => {
    // Regression guard: with this flag off, appointments that stayed Scheduled on a past date
    // were unreachable in every tab, so staff could never resolve (e.g. mark as missed) them.
    expect(expectedAppointmentsPanelConfigSchema.showForPastDate._default).toBe(true);
  });
});
