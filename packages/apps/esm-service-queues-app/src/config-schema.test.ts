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

  it('uses the provisioned service finished concept for completed triage routing', () => {
    expect(configSchema.concepts.finishedServiceStatusConceptUuid._default).toBe(
      '707b1d1e-d7f7-4dad-a382-3734e35933c3',
    );
  });
});
