import { translateFrom } from '@openmrs/esm-framework';
import { type OfflineSynchronizationStore, showNotification } from '@openmrs/esm-framework/src/internal';

import { setupSynchronizingOfflineActionsNotifications } from './synchronizing-notification';

const mocks = vi.hoisted(() => ({
  getState: vi.fn(),
  listener: undefined as ((state: OfflineSynchronizationStore) => void) | undefined,
  subscribe: vi.fn(),
  unsubscribe: vi.fn(),
}));

vi.mock('@openmrs/esm-framework', () => ({
  translateFrom: vi.fn(
    (moduleName: string, key: string, fallback: string) => {
      if (moduleName !== '@sihsalus/esm-offline-tools-app') {
        return fallback;
      }

      const spanishTranslations = {
        offlineActionsSynchronizationNotificationCancelUpload: 'Cancelar carga',
        offlineActionsSynchronizationNotificationStarted:
          'La carga de acciones sin conexión comenzó. Revise las acciones pendientes para ver el estado actual.',
        offlineActionsSynchronizationNotificationTitle: 'Carga',
      };
      return spanishTranslations[key] ?? fallback;
    },
  ),
}));

vi.mock('@openmrs/esm-framework/src/internal', () => ({
  getOfflineSynchronizationStore: () => ({
    getState: mocks.getState,
    subscribe: mocks.subscribe,
  }),
  showNotification: vi.fn(),
}));

const mockShowNotification = vi.mocked(showNotification);
const mockTranslateFrom = vi.mocked(translateFrom);

describe('synchronization notification subscriber', () => {
  it('publishes string content without calling React hooks and keeps cancellation scoped to the active attempt', () => {
    mocks.subscribe.mockImplementation((listener) => {
      mocks.listener = listener;
      return mocks.unsubscribe;
    });

    expect(setupSynchronizingOfflineActionsNotifications()).toBe(mocks.unsubscribe);
    expect(mocks.listener).toBeDefined();

    const firstAbortController = new AbortController();
    const firstSynchronization = {
      abortController: firstAbortController,
      pendingCount: 2,
      totalCount: 2,
    };

    expect(() => mocks.listener?.({ synchronization: firstSynchronization })).not.toThrow();
    expect(mockShowNotification).toHaveBeenCalledWith({
      title: 'Carga',
      description:
        'La carga de acciones sin conexión comenzó. Revise las acciones pendientes para ver el estado actual.',
      action: 'Cancelar carga',
      onAction: expect.any(Function),
    });
    expect(mockTranslateFrom).toHaveBeenNthCalledWith(
      1,
      '@sihsalus/esm-offline-tools-app',
      'offlineActionsSynchronizationNotificationTitle',
      'Upload',
    );
    expect(mockTranslateFrom).toHaveBeenNthCalledWith(
      2,
      '@sihsalus/esm-offline-tools-app',
      'offlineActionsSynchronizationNotificationStarted',
      'Offline action upload started. Review pending actions for current status.',
    );

    const firstNotification = mockShowNotification.mock.calls[0]?.[0];
    expect(firstNotification).toBeDefined();

    mocks.listener?.({ synchronization: undefined });
    mocks.getState.mockReturnValue({ synchronization: undefined });
    firstNotification?.onAction?.();
    expect(firstAbortController.signal.aborted).toBe(false);

    const secondAbortController = new AbortController();
    const secondSynchronization = {
      abortController: secondAbortController,
      pendingCount: 1,
      totalCount: 3,
    };
    mocks.listener?.({ synchronization: secondSynchronization });
    mocks.getState.mockReturnValue({ synchronization: secondSynchronization });

    firstNotification?.onAction?.();
    expect(secondAbortController.signal.aborted).toBe(false);

    const secondNotification = mockShowNotification.mock.calls[1]?.[0];
    secondNotification?.onAction?.();
    expect(secondAbortController.signal.aborted).toBe(true);
  });
});
