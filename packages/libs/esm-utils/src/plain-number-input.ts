const plainDecimalPattern = /^-?(?:\d+|\d+\.\d+)$/;

interface PlainNumberKeyEvent {
  key: string;
  preventDefault(): void;
}

interface PlainNumberClipboardEvent {
  clipboardData: {
    getData(type: string): string;
  };
  preventDefault(): void;
}

export interface PlainNumberInputConstraints {
  integer?: boolean;
  max?: number | null;
  min?: number | null;
  nonNegative?: boolean;
}

export interface PlainNumberInputValidation {
  isInvalid: boolean;
  isInvalidFormat: boolean;
  isOutOfRange: boolean;
  parsedValue: number | undefined;
}

export function isPlainDecimalInput(value: string | number): boolean {
  const normalizedValue = String(value).trim();
  if (!normalizedValue) {
    return false;
  }

  return plainDecimalPattern.test(normalizedValue);
}

export function parsePlainDecimalInput(value: string | number): number | undefined {
  if (!isPlainDecimalInput(value)) {
    return undefined;
  }

  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) ? parsedValue : undefined;
}

export function validatePlainNumberInput(
  value: string | number,
  constraints: PlainNumberInputConstraints = {},
): PlainNumberInputValidation {
  const normalizedValue = String(value).trim();

  if (normalizedValue === '') {
    return {
      isInvalid: false,
      isInvalidFormat: false,
      isOutOfRange: false,
      parsedValue: undefined,
    };
  }

  const parsedValue = parsePlainDecimalInput(normalizedValue);
  const isInvalidFormat =
    parsedValue == null ||
    (constraints.nonNegative === true && parsedValue < 0) ||
    (constraints.integer === true && (!Number.isInteger(parsedValue) || normalizedValue.includes('.')));
  const isOutOfRange =
    !isInvalidFormat &&
    ((typeof constraints.min === 'number' && parsedValue < constraints.min) ||
      (typeof constraints.max === 'number' && parsedValue > constraints.max));

  return {
    isInvalid: isInvalidFormat || isOutOfRange,
    isInvalidFormat,
    isOutOfRange,
    parsedValue: isInvalidFormat ? undefined : parsedValue,
  };
}

export function preventScientificNotationKey(event: PlainNumberKeyEvent) {
  if (event.key === 'e' || event.key === 'E') {
    event.preventDefault();
  }
}

export function preventScientificNotationPaste(event: PlainNumberClipboardEvent) {
  const pastedValue = event.clipboardData.getData('text');
  if (pastedValue && !isPlainDecimalInput(pastedValue)) {
    event.preventDefault();
  }
}

export function preventScientificNotationAndSignKeys(event: PlainNumberKeyEvent) {
  if (event.key === 'e' || event.key === 'E' || event.key === '+' || event.key === '-') {
    event.preventDefault();
  }
}

export function preventScientificNotationAndSignPaste(event: PlainNumberClipboardEvent) {
  const pastedValue = event.clipboardData.getData('text');
  if (pastedValue && (!isPlainDecimalInput(pastedValue) || Number(pastedValue) < 0)) {
    event.preventDefault();
  }
}

const allowedPlainNumberControlKeys = new Set([
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'Backspace',
  'Delete',
  'End',
  'Enter',
  'Escape',
  'Home',
  'Tab',
]);

export function shouldPreventPlainNumberKey(key: string, constraints: PlainNumberInputConstraints = {}) {
  if (allowedPlainNumberControlKeys.has(key)) {
    return false;
  }

  if (key.length > 1) {
    return false;
  }

  if (/^\d$/.test(key)) {
    return false;
  }

  if (key === '.' && constraints.integer !== true) {
    return false;
  }

  if (key === '-' && constraints.nonNegative !== true) {
    return false;
  }

  return true;
}

export function shouldPreventPlainNumberPaste(value: string, constraints: PlainNumberInputConstraints = {}) {
  return Boolean(value) && validatePlainNumberInput(value, constraints).isInvalid;
}
