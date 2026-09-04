import { configSchema } from './config-schema';

describe('laboratory configuration defaults', () => {
  it('keeps realtime notifications disabled until the compatible OMOD is validated', () => {
    expect(configSchema.enableRealtimeLabResultNotifications._default).toBe(false);
  });
});
