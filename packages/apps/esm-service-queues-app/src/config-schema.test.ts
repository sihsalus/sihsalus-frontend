import { builtInColumns, configSchema, defaultQueueTable } from './config-schema';

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
});
