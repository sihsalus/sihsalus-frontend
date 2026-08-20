import { showSnackbar, subscribePrecacheStaticDependencies, syncAllDynamicOfflineData } from '@openmrs/esm-framework';

import { setupOfflineFormPrecache } from './offline-form-precache';

vi.mock('@openmrs/esm-framework', async () => ({
  ...(await vi.importActual('@openmrs/esm-framework')),
  showSnackbar: vi.fn(),
  subscribePrecacheStaticDependencies: vi.fn(),
  syncAllDynamicOfflineData: vi.fn(),
}));

const mockShowSnackbar = vi.mocked(showSnackbar);
const mockSubscribePrecacheStaticDependencies = vi.mocked(subscribePrecacheStaticDependencies);
const mockSyncAllDynamicOfflineData = vi.mocked(syncAllDynamicOfflineData);

describe('offline form precache', () => {
  it('consumes a failed background refresh and shows PHI-safe feedback', async () => {
    mockSyncAllDynamicOfflineData.mockRejectedValue(
      new Error('Failed to synchronize form 1d4d5545-9ee7-43a2-9161-6a48cc219111'),
    );

    setupOfflineFormPrecache();

    const callback = mockSubscribePrecacheStaticDependencies.mock.calls[0]?.[0];
    expect(callback).toBeDefined();
    expect(callback?.({})).toBeUndefined();

    await vi.waitFor(() => {
      expect(mockShowSnackbar).toHaveBeenCalledWith({
        kind: 'error',
        title: 'Offline forms could not be refreshed',
        subtitle: 'Some previously downloaded forms may be out of date. Please try again when online.',
      });
    });
    expect(JSON.stringify(mockShowSnackbar.mock.calls)).not.toContain('1d4d5545-9ee7-43a2-9161-6a48cc219111');
  });
});
