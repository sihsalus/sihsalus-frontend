interface PlainNumberConstraints {
  integer?: boolean;
  max?: number;
  min?: number;
  nonNegative?: boolean;
}

const allowedControlKeys = new Set([
  'Backspace',
  'Delete',
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ArrowDown',
  'Home',
  'End',
  'Tab',
  'Enter',
]);

function isInvalidNumber(value: string, constraints: PlainNumberConstraints = {}) {
  if (!value.trim()) {
    return false;
  }

  const plainNumberRegex = constraints.integer ? /^-?\d+$/ : /^-?(?:\d+|\d*\.\d+)$/;

  if (!plainNumberRegex.test(value)) {
    return true;
  }

  const parsedNumber = Number(value);

  if (!Number.isFinite(parsedNumber)) {
    return true;
  }

  if (constraints.nonNegative && parsedNumber < 0) {
    return true;
  }

  if (typeof constraints.min === 'number' && parsedNumber < constraints.min) {
    return true;
  }

  if (typeof constraints.max === 'number' && parsedNumber > constraints.max) {
    return true;
  }

  return false;
}

export function validatePlainNumberInput(value: string | number, constraints: PlainNumberConstraints = {}) {
  const normalizedValue = String(value);
  const isInvalidFormat = isInvalidNumber(normalizedValue, constraints);

  return {
    isInvalidFormat,
    parsedValue: isInvalidFormat || !normalizedValue.trim() ? null : Number(normalizedValue),
  };
}

export function shouldPreventPlainNumberKey(key: string, constraints: PlainNumberConstraints = {}) {
  if (allowedControlKeys.has(key)) {
    return false;
  }

  if (/^\d$/.test(key)) {
    return false;
  }

  if (!constraints.integer && key === '.') {
    return false;
  }

  return !(key === '-' && !constraints.nonNegative && typeof constraints.min !== 'number');
}

export function shouldPreventPlainNumberPaste(value: string, constraints: PlainNumberConstraints = {}) {
  return validatePlainNumberInput(value, constraints).isInvalidFormat;
}
