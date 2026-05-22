import { launchWorkspace2, setupOfflineSync } from '@openmrs/esm-framework';

import { setupPatientFormSync } from './offline';

const mockLaunchWorkspace2 = vi.mocked(launchWorkspace2);
const mockSetupOfflineSync = vi.mocked(setupOfflineSync);

vi.mock('@openmrs/esm-framework', async () => ({
  ...(await vi.importActual('@openmrs/esm-framework')),
  launchWorkspace2: vi.fn(),
  makeUrl: vi.fn(),
  messageOmrsServiceWorker: vi.fn(),
  omrsOfflineCachingStrategyHttpHeaderName: 'x-offline-strategy',
  openmrsFetch: vi.fn(),
  restBaseUrl: '/ws/rest/v1',
  setupDynamicOfflineDataHandler: vi.fn(),
  setupOfflineSync: vi.fn(),
}));

describe('setupPatientFormSync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('launches canonical queued forms through the workspace2 contract', async () => {
    await setupPatientFormSync();

    const options = mockSetupOfflineSync.mock.calls[0][3] as {
      onBeginEditSyncItem: (syncItem: any) => void;
    };

    options.onBeginEditSyncItem({
      descriptor: { patientUuid: 'patient-uuid' },
      content: {
        _id: 'encounter-uuid',
        form: { uuid: 'form-uuid' },
        encounter: {},
        _payloads: {},
      },
    });

    expect(mockLaunchWorkspace2).toHaveBeenCalledWith(
      'patient-form-entry-workspace-v2',
      {
        form: expect.objectContaining({
          uuid: 'form-uuid',
          display: 'Clinical form',
          name: 'Clinical form',
        }),
        encounterUuid: 'encounter-uuid',
      },
      null,
      {
        patient: null,
        patientUuid: 'patient-uuid',
        visitContext: null,
        mutateVisitContext: null,
      },
    );
  });

  it('keeps legacy queued forms editable through the canonical workspace path', async () => {
    await setupPatientFormSync();

    const options = mockSetupOfflineSync.mock.calls[0][3] as {
      onBeginEditSyncItem: (syncItem: any) => void;
    };

    options.onBeginEditSyncItem({
      descriptor: { patientUuid: 'patient-uuid' },
      content: {
        _id: 'encounter-uuid',
        formSchemaUuid: 'legacy-form-uuid',
        encounter: {},
        _payloads: {},
      },
    });

    expect(mockLaunchWorkspace2).toHaveBeenCalledWith(
      'patient-form-entry-workspace-v2',
      {
        form: expect.objectContaining({
          uuid: 'legacy-form-uuid',
          display: 'Clinical form',
          name: 'Clinical form',
        }),
        encounterUuid: 'encounter-uuid',
      },
      null,
      {
        patient: null,
        patientUuid: 'patient-uuid',
        visitContext: null,
        mutateVisitContext: null,
      },
    );
  });
});
