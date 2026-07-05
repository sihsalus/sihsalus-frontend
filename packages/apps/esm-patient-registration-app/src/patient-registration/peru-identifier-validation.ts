import type { FetchedPatientIdentifierType, PatientIdentifierValue } from './patient-registration.types';
import {
  peruCarnetExtranjeriaPatientIdentifierTypeUuid,
  peruDiePatientIdentifierTypeUuid,
  peruDniPatientIdentifierTypeUuid,
  peruPassportPatientIdentifierTypeUuid,
} from './peru-registration-config';

export interface PeruIdentifierRule {
  pattern: RegExp;
  maxLength: number;
  inputMode?: 'numeric' | 'text';
  sanitize(value: string): string;
  messageKey: string;
  message: string;
  helperKey: string;
  helper: string;
}

function normalizeIdentifierName(name?: string) {
  return (name ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
}

export function getPeruIdentifierRule(
  identifierType?: Pick<FetchedPatientIdentifierType, 'uuid' | 'name'> | null,
  identifier?: Pick<PatientIdentifierValue, 'identifierTypeUuid' | 'identifierName'> | null,
): PeruIdentifierRule | undefined {
  const uuid = identifierType?.uuid ?? identifier?.identifierTypeUuid;
  const name = normalizeIdentifierName(identifierType?.name ?? identifier?.identifierName);

  if (uuid === peruDniPatientIdentifierTypeUuid || name === 'DNI') {
    return {
      pattern: /^\d{8}$/,
      maxLength: 8,
      inputMode: 'numeric',
      sanitize: (value) => value.replace(/\D/g, '').slice(0, 8),
      messageKey: 'dniIdentifierInvalid',
      message: 'DNI must have 8 digits',
      helperKey: 'dniIdentifierHelperText',
      helper: '8 digits',
    };
  }

  if (uuid === peruCarnetExtranjeriaPatientIdentifierTypeUuid || name === 'CE' || name.includes('EXTRANJERIA')) {
    return {
      pattern: /^[A-Z0-9]{6,12}$/i,
      maxLength: 12,
      inputMode: 'text',
      sanitize: (value) =>
        value
          .replace(/[^a-zA-Z0-9]/g, '')
          .toUpperCase()
          .slice(0, 12),
      messageKey: 'ceIdentifierInvalid',
      message: 'CE must have 6 to 12 letters or numbers',
      helperKey: 'ceIdentifierHelperText',
      helper: '6 to 12 letters or numbers',
    };
  }

  if (name === 'CNV' || name.includes('CERTIFICADO DE NACIDO VIVO')) {
    return {
      pattern: /^\d{12}$/,
      maxLength: 12,
      inputMode: 'numeric',
      sanitize: (value) => value.replace(/\D/g, '').slice(0, 12),
      messageKey: 'cnvIdentifierInvalid',
      message: 'CNV must have 12 digits',
      helperKey: 'cnvIdentifierHelperText',
      helper: '12 digits',
    };
  }

  if (uuid === peruDiePatientIdentifierTypeUuid || name === 'DIE' || name.includes('IDENTIDAD EXTRANJERO')) {
    return {
      pattern: /^[A-Z0-9]{9,12}$/i,
      maxLength: 12,
      inputMode: 'text',
      sanitize: (value) =>
        value
          .replace(/[^a-zA-Z0-9]/g, '')
          .toUpperCase()
          .slice(0, 12),
      messageKey: 'dieIdentifierInvalid',
      message: 'DIE must have 9 to 12 letters or numbers',
      helperKey: 'dieIdentifierHelperText',
      helper: '9 to 12 letters or numbers',
    };
  }

  if (uuid === peruPassportPatientIdentifierTypeUuid || name === 'PASS' || name.includes('PASAPORTE')) {
    return {
      pattern: /^[A-Z0-9]{6,9}$/i,
      maxLength: 9,
      inputMode: 'text',
      sanitize: (value) =>
        value
          .replace(/[^a-zA-Z0-9]/g, '')
          .toUpperCase()
          .slice(0, 9),
      messageKey: 'passportIdentifierInvalid',
      message: 'Passport must have 6 to 9 letters or numbers',
      helperKey: 'passportIdentifierHelperText',
      helper: '6 to 9 letters or numbers',
    };
  }

  return undefined;
}
