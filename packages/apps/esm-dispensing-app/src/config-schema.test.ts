import { configSchema } from './config-schema';

describe('dispensing configuration defaults', () => {
  it('keeps realtime notifications disabled until the compatible OMOD is validated', () => {
    expect(configSchema.enableRealtimeMedicationOrderNotifications._default).toBe(false);
  });
});
