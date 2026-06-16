import { describe, expect, it, vi } from 'vitest';
import {
  isPlainDecimalInput,
  parsePlainDecimalInput,
  preventScientificNotationAndSignKeys,
  preventScientificNotationAndSignPaste,
  preventScientificNotationKey,
  preventScientificNotationPaste,
  shouldPreventPlainNumberKey,
  shouldPreventPlainNumberPaste,
  validatePlainNumberInput,
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

  it('validates constrained plain number input', () => {
    expect(validatePlainNumberInput('1e100').isInvalidFormat).toBe(true);
    expect(validatePlainNumberInput('-1', { nonNegative: true }).isInvalidFormat).toBe(true);
    expect(validatePlainNumberInput('+1').isInvalidFormat).toBe(true);
    expect(validatePlainNumberInput('1,2').isInvalidFormat).toBe(true);
    expect(validatePlainNumberInput('12@').isInvalidFormat).toBe(true);
    expect(validatePlainNumberInput('120.0', { integer: true }).isInvalidFormat).toBe(true);
    expect(validatePlainNumberInput('251', { min: 0, max: 250 }).isOutOfRange).toBe(true);
    expect(validatePlainNumberInput('36.5', { nonNegative: true }).parsedValue).toBe(36.5);
  });

  it('keeps empty input valid without coercing it to zero', () => {
    const validation = validatePlainNumberInput('');

    expect(validation.isInvalid).toBe(false);
    expect(validation.isInvalidFormat).toBe(false);
    expect(validation.isOutOfRange).toBe(false);
    expect(validation.parsedValue).toBeUndefined();
  });

  it('allows negative values for generic numeric inputs unless nonNegative is requested', () => {
    expect(validatePlainNumberInput('-1').parsedValue).toBe(-1);
    expect(shouldPreventPlainNumberKey('-')).toBe(false);
    expect(shouldPreventPlainNumberPaste('-1')).toBe(false);

    expect(validatePlainNumberInput('-1', { nonNegative: true }).isInvalidFormat).toBe(true);
    expect(shouldPreventPlainNumberKey('-', { nonNegative: true })).toBe(true);
    expect(shouldPreventPlainNumberPaste('-1', { nonNegative: true })).toBe(true);
  });

  it('allows decimal values while enforcing integer-only fields when configured', () => {
    expect(validatePlainNumberInput('36.5').parsedValue).toBe(36.5);
    expect(shouldPreventPlainNumberKey('.')).toBe(false);
    expect(shouldPreventPlainNumberPaste('36.5')).toBe(false);

    expect(validatePlainNumberInput('36.5', { integer: true }).isInvalidFormat).toBe(true);
    expect(shouldPreventPlainNumberKey('.', { integer: true })).toBe(true);
    expect(shouldPreventPlainNumberPaste('36.5', { integer: true })).toBe(true);
  });

  it('prevents invalid constrained keys without blocking control keys', () => {
    for (const key of ['+', ',', '@', 'e', 'E']) {
      expect(shouldPreventPlainNumberKey(key)).toBe(true);
    }

    expect(shouldPreventPlainNumberKey('-', { nonNegative: true })).toBe(true);
    expect(shouldPreventPlainNumberKey('-', { nonNegative: false })).toBe(false);
    expect(shouldPreventPlainNumberKey('.', { integer: true })).toBe(true);
    expect(shouldPreventPlainNumberKey('.')).toBe(false);
    expect(shouldPreventPlainNumberKey('5')).toBe(false);
    expect(shouldPreventPlainNumberKey('Backspace')).toBe(false);
  });

  it('prevents invalid constrained paste values', () => {
    expect(shouldPreventPlainNumberPaste('+1')).toBe(true);
    expect(shouldPreventPlainNumberPaste('-1', { nonNegative: true })).toBe(true);
    expect(shouldPreventPlainNumberPaste('1,2')).toBe(true);
    expect(shouldPreventPlainNumberPaste('12@')).toBe(true);
    expect(shouldPreventPlainNumberPaste('120.0', { integer: true })).toBe(true);
    expect(shouldPreventPlainNumberPaste('251', { min: 0, max: 250 })).toBe(true);
    expect(shouldPreventPlainNumberPaste('36.5', { nonNegative: true })).toBe(false);
  });
});
