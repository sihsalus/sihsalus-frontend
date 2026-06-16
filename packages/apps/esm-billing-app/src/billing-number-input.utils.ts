import {
  type PlainNumberInputConstraints,
  shouldPreventPlainNumberKey,
  shouldPreventPlainNumberPaste,
  validatePlainNumberInput,
} from '@openmrs/esm-utils';
import type { ClipboardEvent, KeyboardEvent } from 'react';

export const nonNegativeAmountConstraints: PlainNumberInputConstraints = { min: 0, nonNegative: true };
export const billQuantityFormatConstraints: PlainNumberInputConstraints = { integer: true, nonNegative: true };
export const billQuantityConstraints: PlainNumberInputConstraints = { ...billQuantityFormatConstraints, min: 1 };

export function preventInvalidBillingNumberKey(
  event: KeyboardEvent<HTMLInputElement>,
  constraints: PlainNumberInputConstraints = nonNegativeAmountConstraints,
) {
  if (event.ctrlKey || event.metaKey || event.altKey) {
    return;
  }

  if (shouldPreventPlainNumberKey(event.key, constraints)) {
    event.preventDefault();
  }
}

export function preventInvalidBillingNumberPaste(
  event: ClipboardEvent<HTMLInputElement>,
  constraints: PlainNumberInputConstraints = nonNegativeAmountConstraints,
) {
  if (shouldPreventPlainNumberPaste(event.clipboardData.getData('text'), constraints)) {
    event.preventDefault();
  }
}

export function getValidatedBillingNumber(
  value: number | string | undefined,
  constraints: PlainNumberInputConstraints = nonNegativeAmountConstraints,
  options: { enforceRange?: boolean } = {},
) {
  if (value === '' || value === undefined) {
    return undefined;
  }

  const validation = validatePlainNumberInput(value, constraints);
  return validation.isInvalidFormat || (options.enforceRange && validation.isOutOfRange)
    ? undefined
    : validation.parsedValue;
}
