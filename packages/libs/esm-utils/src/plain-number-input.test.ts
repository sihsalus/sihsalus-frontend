import { describe, expect, it, vi } from 'vitest';
import {
  isPlainDecimalInput,
  parsePlainDecimalInput,
  preventScientificNotationAndSignKeys,
  preventScientificNotationAndSignPaste,
  preventScientificNotationKey,
  preventScientificNotationPaste,
} from './plain-number-input';

describe('plain-number-input', () => {
  it('accepts plain decimal values', () => {
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
    const keyEvent = { key: 'e', preventDefault: vi.fn() };
    preventScientificNotationKey(keyEvent);
    expect(keyEvent.preventDefault).toHaveBeenCalled();

    const pasteEvent = {
      clipboardData: { getData: () => '1e100' },
      preventDefault: vi.fn(),
    };
    preventScientificNotationPaste(pasteEvent);
    expect(pasteEvent.preventDefault).toHaveBeenCalled();
  });

  it('keeps allowing the minus sign key in the base handler', () => {
    const minusEvent = { key: '-', preventDefault: vi.fn() };
    preventScientificNotationKey(minusEvent);
    expect(minusEvent.preventDefault).not.toHaveBeenCalled();
  });

  it('prevents sign keys in the strict handler', () => {
    for (const key of ['e', 'E', '+', '-']) {
      const keyEvent = { key, preventDefault: vi.fn() };
      preventScientificNotationAndSignKeys(keyEvent);
      expect(keyEvent.preventDefault).toHaveBeenCalled();
    }

    const digitEvent = { key: '5', preventDefault: vi.fn() };
    preventScientificNotationAndSignKeys(digitEvent);
    expect(digitEvent.preventDefault).not.toHaveBeenCalled();

    const decimalEvent = { key: '.', preventDefault: vi.fn() };
    preventScientificNotationAndSignKeys(decimalEvent);
    expect(decimalEvent.preventDefault).not.toHaveBeenCalled();
  });

  it('prevents pasting negative values in the strict paste handler', () => {
    const blockedPaste = {
      clipboardData: { getData: () => '-5' },
      preventDefault: vi.fn(),
    };
    preventScientificNotationAndSignPaste(blockedPaste);
    expect(blockedPaste.preventDefault).toHaveBeenCalled();

    const allowedPaste = {
      clipboardData: { getData: () => '36.5' },
      preventDefault: vi.fn(),
    };
    preventScientificNotationAndSignPaste(allowedPaste);
    expect(allowedPaste.preventDefault).not.toHaveBeenCalled();
  });
});
