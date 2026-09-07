import { renderHook } from '@testing-library/react';
import useSWRImmutable from 'swr/immutable';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { parseAllowedFileExtensions, useAllowedFileExtensions } from './useAllowedFileExtensions';

vi.mock('swr/immutable', () => ({
  default: vi.fn(() => ({ data: undefined, error: undefined, isLoading: false })),
}));

const mockUseSWRImmutable = vi.mocked(useSWRImmutable);

beforeEach(() => vi.clearAllMocks());

describe('parseAllowedFileExtensions', () => {
  it('normalizes, deduplicates, and preserves valid extensions', () => {
    expect(parseAllowedFileExtensions(' PDF, .jpg, JPEG, jpg, png ')).toEqual(['pdf', 'jpg', 'jpeg', 'png']);
  });

  it.each([
    undefined,
    null,
    '',
    '  ',
    '*',
    '.*',
    'pdf|html',
    'tar.gz',
    '../exe',
  ])('fails closed for a missing or unsafe allowlist value: %s', (value) => {
    expect(parseAllowedFileExtensions(value)).toEqual([]);
  });
});

describe('useAllowedFileExtensions', () => {
  it('does not query system settings when a workflow disables discovery', () => {
    const { result } = renderHook(() => useAllowedFileExtensions(false));

    expect(result.current).toEqual({
      allowedFileExtensions: [],
      error: undefined,
      isConfigured: false,
      isLoading: false,
    });
    expect(mockUseSWRImmutable.mock.calls[0][0]).toBeNull();
  });
});
