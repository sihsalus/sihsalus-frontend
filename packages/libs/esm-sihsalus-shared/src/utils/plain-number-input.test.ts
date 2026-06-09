import { describe, expect, it, vi } from 'vitest';
import {
  isPlainDecimalInput,
  parsePlainDecimalInput,
  preventScientificNotationKey,
  preventScientificNotationPaste,
} from './plain-number-input';

describe('plain number input utilities', () => {
  it('accepts plain integer and decimal values', () => {
    expect(isPlainDecimalInput('100')).toBe(true);
    expect(isPlainDecimalInput('36.5')).toBe(true);
    expect(isPlainDecimalInput('0.5')).toBe(true);
    expect(isPlainDecimalInput('-1.25')).toBe(true);
    expect(parsePlainDecimalInput('36.5')).toBe(36.5);
  });

  it('rejects scientific notation and non-decimal text', () => {
    expect(isPlainDecimalInput('e100')).toBe(false);
    expect(isPlainDecimalInput('1e100')).toBe(false);
    expect(isPlainDecimalInput('.5')).toBe(false);
    expect(isPlainDecimalInput('5.')).toBe(false);
    expect(parsePlainDecimalInput('1e100')).toBeUndefined();
    expect(parsePlainDecimalInput('abc')).toBeUndefined();
  });

  it('prevents e/E keyboard input and scientific notation paste', () => {
    const keyEvent = { key: 'E', preventDefault: vi.fn() };
    preventScientificNotationKey(keyEvent);
    expect(keyEvent.preventDefault).toHaveBeenCalled();

    const pasteEvent = {
      clipboardData: { getData: () => 'e100' },
      preventDefault: vi.fn(),
    };
    preventScientificNotationPaste(pasteEvent);
    expect(pasteEvent.preventDefault).toHaveBeenCalled();
  });
});
