import { afterEach, expect, it, vi } from 'vitest';
import { clearOfflineDownloads } from './offline-profile';
import { messageOmrsServiceWorker } from './service-worker-messaging';

vi.mock('@openmrs/esm-api', () => ({ getSessionStore: vi.fn() }));
vi.mock('./service-worker-messaging', () => ({ messageOmrsServiceWorker: vi.fn() }));
afterEach(() => vi.useRealTimers());
it('requires a confirmed worker result and masks errors', async () => {
  vi.mocked(messageOmrsServiceWorker).mockResolvedValueOnce({ success: false, error: 'private details' });
  await expect(clearOfflineDownloads()).rejects.toThrow('The offline profile is unavailable.');
  vi.mocked(messageOmrsServiceWorker).mockRejectedValueOnce(new Error('private details'));
  await expect(clearOfflineDownloads()).rejects.not.toThrow('private details');
  vi.mocked(messageOmrsServiceWorker).mockResolvedValueOnce({ success: true });
  await expect(clearOfflineDownloads()).resolves.toBeUndefined();
});
it('releases the caller when an old or stopped worker never replies', async () => {
  vi.useFakeTimers();
  vi.mocked(messageOmrsServiceWorker).mockImplementationOnce(() => new Promise(() => {}));
  const result = expect(clearOfflineDownloads()).rejects.toThrow('The offline profile is unavailable.');
  await vi.advanceTimersByTimeAsync(15001);
  await result;
});
