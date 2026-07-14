import {
  getPeruIdentityDocumentRule,
  type PeruIdentityDocumentKind,
  type PeruIdentityDocumentRule,
} from '@openmrs/esm-utils';

import type { Config } from '../config-schema';

export type EmergencyIdentifierConfig = Pick<
  Config['patientRegistration'],
  | 'defaultIdentifierTypeUuid'
  | 'dieIdentifierTypeUuid'
  | 'foreignCardIdentifierTypeUuid'
  | 'liveBirthCertificateIdentifierTypeUuid'
  | 'otherIdentifierFormat'
  | 'otherIdentifierMaxLength'
  | 'otherIdentifierTypeUuid'
  | 'passportIdentifierTypeUuid'
>;

const validationMessages: Record<PeruIdentityDocumentKind, string> = {
  dni: 'El DNI debe tener exactamente 8 dígitos',
  ce: 'El CE debe tener entre 6 y 12 letras o números',
  passport: 'El pasaporte debe tener entre 6 y 9 letras o números',
  die: 'El DIE debe tener hasta 15 letras o números',
  cnv: 'El CNV debe tener exactamente 12 dígitos',
};

function getEmergencyIdentityDocumentKind(
  config: EmergencyIdentifierConfig,
  identifierTypeUuid?: string,
): PeruIdentityDocumentKind | undefined {
  if (!identifierTypeUuid || hasEmergencyIdentifierTypeCollision(config, identifierTypeUuid)) return undefined;
  if (identifierTypeUuid === config.defaultIdentifierTypeUuid) return 'dni';
  if (identifierTypeUuid === config.foreignCardIdentifierTypeUuid) return 'ce';
  if (identifierTypeUuid === config.passportIdentifierTypeUuid) return 'passport';
  if (identifierTypeUuid === config.dieIdentifierTypeUuid) return 'die';
  if (identifierTypeUuid === config.liveBirthCertificateIdentifierTypeUuid) return 'cnv';
  return undefined;
}

function getConfiguredIdentifierTypeUuids(config: EmergencyIdentifierConfig): Array<string> {
  return [
    config.defaultIdentifierTypeUuid,
    config.foreignCardIdentifierTypeUuid,
    config.passportIdentifierTypeUuid,
    config.dieIdentifierTypeUuid,
    config.liveBirthCertificateIdentifierTypeUuid,
    config.otherIdentifierTypeUuid,
  ].filter(Boolean);
}

function hasEmergencyIdentifierTypeCollision(config: EmergencyIdentifierConfig, identifierTypeUuid: string): boolean {
  return getConfiguredIdentifierTypeUuids(config).filter((uuid) => uuid === identifierTypeUuid).length > 1;
}

function isSafeBoundedIdentifierFormat(format: string): boolean {
  const body = format.slice(1, -1);
  if (!body || /[()|*+?]/.test(body) || /\\[1-9]/.test(body)) {
    return false;
  }

  const quantifiers = [...body.matchAll(/\{(\d+)(?:,(\d+))?\}/g)];
  if (
    quantifiers.some(([, minimum, maximum]) => {
      const min = Number(minimum);
      const max = Number(maximum ?? minimum);
      return min > max || max > 100;
    })
  ) {
    return false;
  }

  const bodyWithoutQuantifiers = body.replace(/\{\d+(?:,\d+)?\}/g, '');
  return !/[{}.^$]/.test(bodyWithoutQuantifiers);
}

export function getEmergencyIdentityDocumentConfigurationError(config: EmergencyIdentifierConfig): string | undefined {
  const configuredUuids = getConfiguredIdentifierTypeUuids(config);
  if (new Set(configuredUuids).size !== configuredUuids.length) {
    return 'Hay tipos de documento configurados con el mismo UUID. Contacte al administrador.';
  }
  return undefined;
}

export function getEmergencyIdentityDocumentRule(
  config: EmergencyIdentifierConfig,
  identifierTypeUuid?: string,
): PeruIdentityDocumentRule | undefined {
  if (!identifierTypeUuid || hasEmergencyIdentifierTypeCollision(config, identifierTypeUuid)) {
    return undefined;
  }

  if (identifierTypeUuid && identifierTypeUuid === config.otherIdentifierTypeUuid) {
    const format = config.otherIdentifierFormat?.trim();
    const maxLength = config.otherIdentifierMaxLength;
    if (
      !format ||
      format.length > 200 ||
      !format.startsWith('^') ||
      !format.endsWith('$') ||
      !isSafeBoundedIdentifierFormat(format) ||
      !Number.isInteger(maxLength) ||
      maxLength < 1 ||
      maxLength > 100
    ) {
      return undefined;
    }

    try {
      const pattern = new RegExp(format, 'u');
      return {
        pattern,
        maxLength,
        sanitize: (value) => value.trim(),
        messageKey: 'otherIdentifierInvalid',
        message: 'The identifier does not match the configured format',
        helperKey: 'otherIdentifierHelperText',
        helper: 'Configured institutional format',
      };
    } catch {
      return undefined;
    }
  }

  return getPeruIdentityDocumentRule(getEmergencyIdentityDocumentKind(config, identifierTypeUuid));
}

export function validateEmergencyIdentityDocument(
  config: EmergencyIdentifierConfig,
  identifierTypeUuid?: string,
  rawIdentifier?: string,
): { identifier?: string; error?: string } {
  const trimmedIdentifier = rawIdentifier?.trim() ?? '';
  if (!trimmedIdentifier) {
    return {};
  }

  if (identifierTypeUuid && hasEmergencyIdentifierTypeCollision(config, identifierTypeUuid)) {
    return { error: 'La configuración del tipo de documento es ambigua. Contacte al administrador' };
  }

  const kind = getEmergencyIdentityDocumentKind(config, identifierTypeUuid);
  const rule = getEmergencyIdentityDocumentRule(config, identifierTypeUuid);
  if (!rule) {
    return { error: 'Seleccione un tipo de documento con una regla de validación aprobada' };
  }

  const normalizedIdentifier = rule.sanitize(trimmedIdentifier);
  if (normalizedIdentifier.length > rule.maxLength || !rule.pattern.test(normalizedIdentifier)) {
    return {
      error: kind ? validationMessages[kind] : 'El documento no cumple el formato institucional configurado',
    };
  }

  return { identifier: normalizedIdentifier };
}

export function getEmergencyIdentityDocumentTypes(config: EmergencyIdentifierConfig) {
  const types = [
    { label: 'DNI', value: config.defaultIdentifierTypeUuid },
    { label: 'CE', value: config.foreignCardIdentifierTypeUuid },
    { label: 'Pasaporte', value: config.passportIdentifierTypeUuid },
    { label: 'DIE', value: config.dieIdentifierTypeUuid },
    { label: 'CNV', value: config.liveBirthCertificateIdentifierTypeUuid },
  ].filter((type) => type.value && !hasEmergencyIdentifierTypeCollision(config, type.value));

  if (getEmergencyIdentityDocumentRule(config, config.otherIdentifierTypeUuid)) {
    types.push({ label: 'Otros', value: config.otherIdentifierTypeUuid });
  }

  return types;
}
