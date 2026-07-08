import { generateOdontogramId } from './generateOdontogramId';

describe('generateOdontogramId', () => {
  it('uses crypto.randomUUID when available', () => {
    const nativeId = '00000000-0000-4000-8000-000000000000';
    const id = generateOdontogramId({ randomUUID: () => nativeId });

    expect(id).toBe(nativeId);
  });

  it('falls back to getRandomValues when randomUUID is unavailable', () => {
    const id = generateOdontogramId({
      getRandomValues: (array) => {
        const bytes = array as unknown as Uint8Array;
        bytes.forEach((_, index) => {
          bytes[index] = index;
        });
        return array;
      },
    });

    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});
