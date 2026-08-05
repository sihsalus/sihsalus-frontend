import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getOmrsServiceWorker } from './service-worker';
import { messageOmrsServiceWorker } from './service-worker-messaging';

vi.mock('./service-worker', () => ({
  getOmrsServiceWorker: vi.fn(),
}));

const mockGetOmrsServiceWorker = vi.mocked(getOmrsServiceWorker);
const message = {
  type: 'registerDynamicRoute' as const,
  pattern: '/openmrs/ws/rest/v1/visit/.+',
};

describe('messageOmrsServiceWorker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a controlled failure when service worker registration was rejected', async () => {
    mockGetOmrsServiceWorker.mockRejectedValue(new Error('Service worker registration failed'));

    await expect(messageOmrsServiceWorker(message)).resolves.toEqual({
      success: false,
      result: undefined,
      error: 'Service worker registration failed',
    });
  });

  it('returns a controlled failure when the build has no service worker', async () => {
    mockGetOmrsServiceWorker.mockResolvedValue(undefined);

    await expect(messageOmrsServiceWorker(message)).resolves.toMatchObject({
      success: false,
      result: undefined,
    });
  });

  it('forwards messages when the service worker is available', async () => {
    const result = { success: true, result: 'registered' };
    const workbox = { messageSW: vi.fn().mockResolvedValue(result) };
    mockGetOmrsServiceWorker.mockResolvedValue(workbox as Awaited<ReturnType<typeof getOmrsServiceWorker>>);

    await expect(messageOmrsServiceWorker(message)).resolves.toEqual(result);
    expect(workbox.messageSW).toHaveBeenCalledWith(message);
  });

  it('preserves message processing failures for callers that handle them', async () => {
    const workbox = { messageSW: vi.fn().mockRejectedValue(new Error('Message processing failed')) };
    mockGetOmrsServiceWorker.mockResolvedValue(workbox as Awaited<ReturnType<typeof getOmrsServiceWorker>>);

    await expect(messageOmrsServiceWorker(message)).rejects.toThrow('Message processing failed');
  });
});
