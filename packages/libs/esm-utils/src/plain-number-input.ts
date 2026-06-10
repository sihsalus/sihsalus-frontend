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
