import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { SWRConfig } from 'swr';
import { useDoctorResults } from './doctor-results.resource';
const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  config: { enableDoctorResultNotifications: true },
  session: {
    authenticated: true,
    sessionId: 'session',
    user: {
      uuid: 'doctor',
      privileges: ['app:hoja.clinica.ordenes', 'Get Orders', 'Get Patients', 'Get Observations'].map((name) => ({
        name,
      })),
    },
    sessionLocation: { uuid: 'facility' },
  },
}));
vi.mock('@openmrs/esm-framework', () => ({
  openmrsFetch: mocks.fetch,
  restBaseUrl: '/openmrs/ws/rest/v1',
  useConfig: () => mocks.config,
  useSession: () => mocks.session,
}));
class Source {
  static instances: Source[] = [];
  listeners = new Map<string, () => void>();
  close = vi.fn();
  constructor(readonly url: string) {
    Source.instances.push(this);
  }
  addEventListener(type: string, callback: () => void) {
    this.listeners.set(type, callback);
  }
}
function wrapper({ children }: { children: React.ReactNode }) {
  return <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>{children}</SWRConfig>;
}
beforeEach(() => {
  vi.stubGlobal('EventSource', Source);
  Source.instances = [];
  mocks.config.enableDoctorResultNotifications = true;
  mocks.session.authenticated = true;
  mocks.session.user.uuid = 'doctor';
  mocks.session.sessionLocation.uuid = 'facility';
  mocks.session.user.privileges = ['app:hoja.clinica.ordenes', 'Get Orders', 'Get Patients', 'Get Observations'].map(
    (name) => ({ name }),
  );
  mocks.fetch.mockReset().mockResolvedValue({ data: { results: [], total: 0, hasMore: false } });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
it('is off by default configuration or absent privilege/session and never connects', async () => {
  mocks.config.enableDoctorResultNotifications = false;
  const { result, rerender } = renderHook(() => useDoctorResults(), {
    wrapper,
  });
  expect(result.current.allowed).toBe(false);
  expect(mocks.fetch).not.toHaveBeenCalled();
  mocks.config.enableDoctorResultNotifications = true;
  mocks.session.user.privileges = [];
  rerender();
  expect(result.current.allowed).toBe(false);
  expect(Source.instances).toHaveLength(0);
  mocks.session.authenticated = false;
  rerender();
  expect(mocks.fetch).not.toHaveBeenCalled();
});
it('loads authoritative pending state on a fresh mount and never marks it read', async () => {
  const { result } = renderHook(() => useDoctorResults(), { wrapper });
  await waitFor(() => expect(result.current.data?.total).toBe(0));
  expect(mocks.fetch).toHaveBeenCalledWith('/openmrs/ws/sihsalus/notifications/results?offset=0', {
    cache: 'no-store',
  });
  expect(mocks.fetch).toHaveBeenCalledTimes(1);
  expect(Source.instances[0].url).toContain('topics=clinical-results');
});
it('collapses 100 incoming signals into one refresh and cancels timers on unmount', async () => {
  const { result, unmount } = renderHook(() => useDoctorResults(), { wrapper });
  await waitFor(() => expect(result.current.data).toBeDefined());
  vi.useFakeTimers();
  act(() => {
    for (let i = 0; i < 100; i++) Source.instances[0].listeners.get('LAB_RESULT_READY')?.();
  });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1000);
  });
  expect(mocks.fetch).toHaveBeenCalledTimes(2);
  act(() => Source.instances[0].listeners.get('SIHSALUS_RESYNC_REQUIRED')?.());
  unmount();
  await vi.advanceTimersByTimeAsync(1000);
  expect(Source.instances[0].close).toHaveBeenCalledOnce();
  expect(mocks.fetch).toHaveBeenCalledTimes(2);
});
it('clears data and replaces the subscription when the user or facility changes', async () => {
  mocks.fetch.mockResolvedValueOnce({
    data: { results: [], total: 5, hasMore: false },
  });
  const { result, rerender } = renderHook(() => useDoctorResults(), {
    wrapper,
  });
  await waitFor(() => expect(result.current.data?.total).toBe(5));
  mocks.fetch.mockImplementation(() => new Promise(() => {}));
  mocks.session.user.uuid = 'other';
  mocks.session.sessionLocation.uuid = 'other-facility';
  rerender();
  expect(result.current.data).toBeUndefined();
  expect(Source.instances[0].close).toHaveBeenCalledOnce();
  expect(Source.instances).toHaveLength(2);
});
it('does not erase a pending result after a failed review and exposes refresh errors', async () => {
  mocks.fetch.mockResolvedValueOnce({
    data: { results: [{ id: 8 }], total: 1, hasMore: false },
  });
  const { result } = renderHook(() => useDoctorResults(), { wrapper });
  await waitFor(() => expect(result.current.data?.total).toBe(1));
  mocks.fetch.mockRejectedValue(new Error('failed'));
  await expect(result.current.review(8)).rejects.toThrow('failed');
  expect(result.current.data?.total).toBe(1);
});
it('confirmed review stays successful even if subsequent refresh fails', async () => {
  mocks.fetch.mockResolvedValueOnce({
    data: { results: [{ id: 8 }], total: 1, hasMore: false },
  });
  const { result } = renderHook(() => useDoctorResults(), { wrapper });
  await waitFor(() => expect(result.current.data?.total).toBe(1));
  mocks.fetch.mockResolvedValueOnce({ data: undefined }).mockRejectedValue(new Error('refresh failed'));
  await act(async () => {
    await result.current.review(8);
  });
  expect(result.current.data?.total).toBe(0);
  await waitFor(() => expect(result.current.error).toBeDefined());
});
