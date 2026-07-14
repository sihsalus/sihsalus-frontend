export type PeruIdentityDocumentKind = 'dni' | 'ce' | 'passport' | 'die' | 'cnv';

export interface PeruIdentityDocumentRule {
  pattern: RegExp;
  maxLength: number;
  inputMode?: 'numeric' | 'text';
  sanitize(value: string): string;
  messageKey: string;
  message: string;
  helperKey: string;
  helper: string;
}

const removePresentationSeparators = (value: string) => value.replace(/[\s-]+/g, '');

// Normalize only harmless presentation differences. Invalid characters and excess
// length must remain visible so validation can reject the value instead of silently
// turning a different document number into a valid one.
const alphanumericSanitizer = (value: string) => removePresentationSeparators(value).toUpperCase();

const rules: Record<PeruIdentityDocumentKind, PeruIdentityDocumentRule> = {
  dni: {
    pattern: /^\d{8}$/,
    maxLength: 8,
    inputMode: 'numeric',
    sanitize: removePresentationSeparators,
    messageKey: 'dniIdentifierInvalid',
    message: 'DNI must have 8 digits',
    helperKey: 'dniIdentifierHelperText',
    helper: '8 digits',
  },
  ce: {
    pattern: /^[A-Z0-9]{6,12}$/,
    maxLength: 12,
    inputMode: 'text',
    sanitize: alphanumericSanitizer,
    messageKey: 'ceIdentifierInvalid',
    message: 'CE must have 6 to 12 letters or numbers',
    helperKey: 'ceIdentifierHelperText',
    helper: '6 to 12 letters or numbers',
  },
  passport: {
    pattern: /^[A-Z0-9]{6,9}$/,
    maxLength: 9,
    inputMode: 'text',
    sanitize: alphanumericSanitizer,
    messageKey: 'passportIdentifierInvalid',
    message: 'Passport must have 6 to 9 letters or numbers',
    helperKey: 'passportIdentifierHelperText',
    helper: '6 to 9 letters or numbers',
  },
  die: {
    pattern: /^[A-Z0-9]{1,15}$/,
    maxLength: 15,
    inputMode: 'text',
    sanitize: alphanumericSanitizer,
    messageKey: 'dieIdentifierInvalid',
    message: 'DIE must have up to 15 letters or numbers',
    helperKey: 'dieIdentifierHelperText',
    helper: 'Up to 15 letters or numbers',
  },
  cnv: {
    pattern: /^\d{12}$/,
    maxLength: 12,
    inputMode: 'numeric',
    sanitize: removePresentationSeparators,
    messageKey: 'cnvIdentifierInvalid',
    message: 'CNV must have 12 digits',
    helperKey: 'cnvIdentifierHelperText',
    helper: '12 digits',
  },
};

export function getPeruIdentityDocumentRule(kind?: PeruIdentityDocumentKind): PeruIdentityDocumentRule | undefined {
  return kind ? rules[kind] : undefined;
}
