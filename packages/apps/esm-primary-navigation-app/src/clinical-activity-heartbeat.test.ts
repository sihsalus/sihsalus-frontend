import {
  clinicalActivityHeartbeatIntervalMs,
  clinicalActivityHeartbeatUrl,
  clinicalActivityRecentInteractionMs,
  setupClinicalActivityHeartbeat,
  stopClinicalActivityHeartbeat,
} from './clinical-activity-heartbeat';

const mockFetch = vi.fn().mockResolvedValue({ ok: true });

describe('clinical activity heartbeat', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-24T17:45:00.000Z'));
    vi.stubGlobal('fetch', mockFetch);
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    mockFetch.mockClear();
  });

  afterEach(() => {
    stopClinicalActivityHeartbeat();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('sends only a bodyless, credential-free same-origin presence signal', () => {
    setupClinicalActivityHeartbeat();

    expect(mockFetch).toHaveBeenCalledOnce();
    expect(mockFetch).toHaveBeenCalledWith(clinicalActivityHeartbeatUrl, {
      method: 'POST',
      body: null,
      cache: 'no-store',
      credentials: 'omit',
      keepalive: true,
      referrerPolicy: 'no-referrer',
    });

    vi.advanceTimersByTime(clinicalActivityHeartbeatIntervalMs);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('stops signaling after the recent-interaction window and resumes after operator input', () => {
    setupClinicalActivityHeartbeat();
    mockFetch.mockClear();

    vi.setSystemTime(new Date(Date.now() + clinicalActivityRecentInteractionMs + 1));
    vi.advanceTimersByTime(clinicalActivityHeartbeatIntervalMs);
    expect(mockFetch).not.toHaveBeenCalled();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' }));
    vi.advanceTimersByTime(clinicalActivityHeartbeatIntervalMs);
    expect(mockFetch).toHaveBeenCalledOnce();
  });

  it('does not signal while the document is hidden', () => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });

    setupClinicalActivityHeartbeat();
    vi.advanceTimersByTime(clinicalActivityHeartbeatIntervalMs);

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('registers a single interval when startup is called repeatedly', () => {
    setupClinicalActivityHeartbeat();
    setupClinicalActivityHeartbeat();
    mockFetch.mockClear();

    vi.advanceTimersByTime(clinicalActivityHeartbeatIntervalMs);

    expect(mockFetch).toHaveBeenCalledOnce();
  });
});
