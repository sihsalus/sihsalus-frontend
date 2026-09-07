import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileAsString } from './utils';

afterEach(() => vi.restoreAllMocks());

describe('readFileAsString', () => {
  it('reads a synthetic file as a data URL', async () => {
    await expect(readFileAsString(new File(['synthetic'], 'image.png', { type: 'image/png' }))).resolves.toBe(
      'data:image/png;base64,c3ludGhldGlj',
    );
  });

  it.each(['error', 'abort'])('rejects when FileReader emits %s', async (event) => {
    vi.spyOn(FileReader.prototype, 'readAsDataURL').mockImplementation(function (this: FileReader) {
      this.dispatchEvent(new Event(event));
    });
    await expect(readFileAsString(new File(['synthetic'], 'image.png'))).rejects.toThrow('could not be read');
  });

  it('rejects a read that completes without file content', async () => {
    vi.spyOn(FileReader.prototype, 'readAsDataURL').mockImplementation(function (this: FileReader) {
      this.dispatchEvent(new Event('load'));
    });
    await expect(readFileAsString(new File(['synthetic'], 'image.png'))).rejects.toThrow('could not be read');
  });
});
