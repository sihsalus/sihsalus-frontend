import { expectKnownGap } from './expect-known-gap';

describe('expectKnownGap', () => {
  it('keeps a reproduced acceptance gap green', async () => {
    await expect(
      expectKnownGap(() => {
        expect('current behavior').toBe('accepted behavior');
      }),
    ).resolves.toBeUndefined();
  });

  it('does not hide setup or runtime errors', async () => {
    await expect(
      expectKnownGap(() => {
        throw new Error('backend unavailable');
      }),
    ).rejects.toThrow('backend unavailable');
  });

  it('forces a passing gap to be converted into a regular test', async () => {
    await expect(expectKnownGap(() => undefined)).rejects.toThrow('Known acceptance gap now passes');
  });
});
