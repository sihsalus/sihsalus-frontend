import { describe, expect, it } from 'vitest';
import { parseAllowedFileExtensions } from './useAllowedFileExtensions';

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
