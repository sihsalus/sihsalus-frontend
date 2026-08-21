export const offlineSynchronizationError = Object.freeze({
  name: 'OfflineSynchronizationError',
  message: 'Offline synchronization failed.',
});

export function createOfflineSynchronizationErrorRecord() {
  return { ...offlineSynchronizationError };
}
