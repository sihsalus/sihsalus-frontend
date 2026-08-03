import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getAttachmentErrorStatus, useAttachments } from './useAttachments';

const mocks = vi.hoisted(() => ({
  openmrsFetch: vi.fn(),
  useSWR: vi.fn(),
}));

vi.mock('@openmrs/esm-api', () => ({
  openmrsFetch: mocks.openmrsFetch,
}));

vi.mock('@openmrs/esm-emr-api', () => ({
  attachmentUrl: '/ws/rest/v1/attachment',
}));

vi.mock('swr', () => ({
  default: (...args: Array<unknown>) => mocks.useSWR(...args),
}));

const cachedAttachment = {
  bytesContentFamily: 'IMAGE',
  bytesMimeType: 'image/png',
  comment: 'Clinical image',
  dateTime: '2026-08-03T12:00:00.000Z',
  filename: 'clinical-image.png',
  uuid: 'attachment-uuid',
};

describe('useAttachments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.openmrsFetch.mockResolvedValue({ data: { results: [] } });
    mocks.useSWR.mockReturnValue({
      data: undefined,
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: vi.fn(),
    });
  });

  it('does not create an SWR request key when fetching is disabled', () => {
    const { result } = renderHook(() => useAttachments('patient-uuid', true, false));

    expect(mocks.useSWR).toHaveBeenCalledWith(null, expect.any(Function), undefined);
    expect(result.current).toEqual(
      expect.objectContaining({
        data: [],
        error: undefined,
        isLoading: false,
        isValidating: false,
      }),
    );
  });

  it('restores the request key when fetching is enabled again', () => {
    const { rerender } = renderHook(({ enabled }) => useAttachments('patient-uuid', true, enabled, 'user-uuid'), {
      initialProps: { enabled: false },
    });

    expect(mocks.useSWR).toHaveBeenLastCalledWith(null, expect.any(Function), expect.any(Object));

    rerender({ enabled: true });

    expect(mocks.useSWR).toHaveBeenLastCalledWith(
      ['patient-attachments', expect.stringContaining('patient=patient-uuid&includeEncounterless=true'), 'user-uuid'],
      expect.any(Function),
      expect.any(Object),
    );
  });

  it('isolates the SWR request key when the authenticated user changes', () => {
    const { rerender } = renderHook(({ cacheScope }) => useAttachments('patient-uuid', true, true, cacheScope), {
      initialProps: { cacheScope: 'user-a-uuid' },
    });

    expect(mocks.useSWR).toHaveBeenLastCalledWith(
      ['patient-attachments', expect.any(String), 'user-a-uuid'],
      expect.any(Function),
      expect.any(Object),
    );

    rerender({ cacheScope: 'user-b-uuid' });

    expect(mocks.useSWR).toHaveBeenLastCalledWith(
      ['patient-attachments', expect.any(String), 'user-b-uuid'],
      expect.any(Function),
      expect.any(Object),
    );
  });

  it('preserves legacy fetch and retry semantics when no cache scope is supplied', async () => {
    renderHook(() => useAttachments('patient-uuid', true));
    const [requestKey, fetcher, options] = mocks.useSWR.mock.lastCall as [
      string,
      (key: string) => Promise<unknown>,
      undefined,
    ];

    await fetcher(requestKey);

    expect(mocks.openmrsFetch.mock.calls).toEqual([[requestKey]]);
    expect(options).toBeUndefined();
  });

  it('prevents authorization retries only for session-scoped attachment requests', () => {
    renderHook(() => useAttachments('patient-uuid', true, true, 'session:user'));
    const options = mocks.useSWR.mock.lastCall?.[2] as {
      shouldRetryOnError: (error: unknown) => boolean;
    };

    expect(options.shouldRetryOnError({ response: { status: 401 } })).toBe(false);
    expect(options.shouldRetryOnError({ response: { status: 403 } })).toBe(false);
    expect(options.shouldRetryOnError({ response: { status: 404 } })).toBe(true);
    expect(options.shouldRetryOnError({ response: { status: 408 } })).toBe(true);
    expect(options.shouldRetryOnError({ response: { status: 425 } })).toBe(true);
    expect(options.shouldRetryOnError({ response: { status: 429 } })).toBe(true);
    expect(options.shouldRetryOnError({ response: { status: 500 } })).toBe(true);
    expect(options.shouldRetryOnError(new TypeError('Failed to fetch'))).toBe(true);
  });

  it.each([401, 403])('does not expose cached attachments after an HTTP %s response', (status) => {
    const error = Object.assign(new Error(`HTTP ${status}`), { response: { status } });
    mocks.useSWR.mockReturnValue({
      data: { data: { results: [cachedAttachment] } },
      error,
      isLoading: false,
      isValidating: false,
      mutate: vi.fn(),
    });

    const { result } = renderHook(() => useAttachments('patient-uuid', true, true, 'session:user'));

    expect(result.current.data).toEqual([]);
    expect(result.current.error).toBe(error);
  });

  it('preserves cached attachments after an authorization error in legacy unscoped mode', () => {
    const error = Object.assign(new Error('HTTP 401'), { response: { status: 401 } });
    mocks.useSWR.mockReturnValue({
      data: { data: { results: [cachedAttachment] } },
      error,
      isLoading: false,
      isValidating: false,
      mutate: vi.fn(),
    });

    const { result } = renderHook(() => useAttachments('patient-uuid', true));

    expect(result.current.data).toEqual([cachedAttachment]);
    expect(result.current.error).toBe(error);
  });

  it('preserves cached attachments after a server error', () => {
    const error = Object.assign(new Error('Internal server error'), { response: { status: 500 } });
    mocks.useSWR.mockReturnValue({
      data: { data: { results: [cachedAttachment] } },
      error,
      isLoading: false,
      isValidating: false,
      mutate: vi.fn(),
    });

    const { result } = renderHook(() => useAttachments('patient-uuid', true));

    expect(result.current.data).toEqual([cachedAttachment]);
    expect(result.current.error).toBe(error);
  });

  it.each([
    [{ response: { status: 403 } }, 403],
    [{ status: '429' }, 429],
    [{ statusCode: 500 }, 500],
    [{ responseBody: { error: { status: '401' } } }, 401],
    [new Error('Server responded with 503'), 503],
    ['HTTP 408', 408],
    ['HTTP status code500', 500],
    ['http status code 401', 401],
    ['HTTP status code: 409', 409],
    ['status code: 425', 425],
  ])('reads HTTP status from supported error shape %#', (error, expectedStatus) => {
    expect(getAttachmentErrorStatus(error)).toBe(expectedStatus);
  });

  it('does not infer an HTTP status from an unrelated number in an error message', () => {
    expect(getAttachmentErrorStatus(new Error('Attachment abc-500-def failed'))).toBeUndefined();
  });

  it('parses a compact HTTP status without a separator', () => {
    expect(getAttachmentErrorStatus(new Error('HTTP500'))).toBe(500);
  });

  it('safely ignores an adversarially long separator without a status code', () => {
    expect(getAttachmentErrorStatus(new Error(`HTTP${' '.repeat(50_000)}not-a-status`))).toBeUndefined();
  });
});
