import { describe, expect, it, vi } from 'vitest';
import {
  billQuantityConstraints,
  billQuantityFormatConstraints,
  getValidatedBillingNumber,
  nonNegativeAmountConstraints,
  preventInvalidBillingNumberKey,
  preventInvalidBillingNumberPaste,
} from './billing-number-input.utils';

describe('billing-number-input utils', () => {
  it('accepts plain non-negative amounts and rejects scientific notation or signs', () => {
    expect(getValidatedBillingNumber('12.5', nonNegativeAmountConstraints)).toBe(12.5);
    expect(getValidatedBillingNumber('1e2', nonNegativeAmountConstraints)).toBeUndefined();
    expect(getValidatedBillingNumber('+12', nonNegativeAmountConstraints)).toBeUndefined();
    expect(getValidatedBillingNumber('-12', nonNegativeAmountConstraints)).toBeUndefined();
    expect(getValidatedBillingNumber('12,5', nonNegativeAmountConstraints)).toBeUndefined();
  });

  it('enforces integer quantities', () => {
    expect(getValidatedBillingNumber('3', billQuantityConstraints)).toBe(3);
    expect(getValidatedBillingNumber('0', billQuantityConstraints)).toBe(0);
    expect(getValidatedBillingNumber('0', billQuantityConstraints, { enforceRange: true })).toBeUndefined();
    expect(getValidatedBillingNumber('2.5', billQuantityConstraints)).toBeUndefined();
    expect(getValidatedBillingNumber('1e2', billQuantityConstraints)).toBeUndefined();
  });

  it('prevents invalid keys and paste payloads', () => {
    for (const key of ['e', 'E', '+', '-', '.', ',']) {
      const event = { key, preventDefault: vi.fn() };
      preventInvalidBillingNumberKey(event as never, billQuantityFormatConstraints);
      expect(event.preventDefault).toHaveBeenCalled();
    }

    const pasteEvent = {
      clipboardData: { getData: () => '1e2' },
      preventDefault: vi.fn(),
    };
    preventInvalidBillingNumberPaste(pasteEvent as never, billQuantityFormatConstraints);
    expect(pasteEvent.preventDefault).toHaveBeenCalled();
  });
});
