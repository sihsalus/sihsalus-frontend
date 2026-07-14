import {
  getEmergencyIdentityDocumentConfigurationError,
  getEmergencyIdentityDocumentTypes,
  validateEmergencyIdentityDocument,
} from './emergency-identity-documents';

const config = {
  defaultIdentifierTypeUuid: 'dni-uuid',
  dieIdentifierTypeUuid: 'die-uuid',
  foreignCardIdentifierTypeUuid: 'ce-uuid',
  liveBirthCertificateIdentifierTypeUuid: 'cnv-uuid',
  otherIdentifierFormat: '^[A-Z0-9]{6,20}$',
  otherIdentifierMaxLength: 20,
  otherIdentifierTypeUuid: 'other-uuid',
  passportIdentifierTypeUuid: 'passport-uuid',
};

describe('getEmergencyIdentityDocumentTypes', () => {
  it('includes Otros only when a deployed identifier type is explicitly configured', () => {
    const identifierTypes = getEmergencyIdentityDocumentTypes(config);

    expect(identifierTypes).toEqual([
      { label: 'DNI', value: 'dni-uuid' },
      { label: 'CE', value: 'ce-uuid' },
      { label: 'Pasaporte', value: 'passport-uuid' },
      { label: 'DIE', value: 'die-uuid' },
      { label: 'CNV', value: 'cnv-uuid' },
      { label: 'Otros', value: 'other-uuid' },
    ]);
  });

  it('does not offer Otros when its identifier type is not deployed', () => {
    const identifierTypes = getEmergencyIdentityDocumentTypes({
      ...config,
      otherIdentifierFormat: '',
    });

    expect(identifierTypes).not.toContainEqual(expect.objectContaining({ label: 'Otros' }));
  });

  it.each([
    '^(A+)+$',
    '^[A-Z]{1,1000}$',
    '^(?:[A-Z0-9]{6}|[0-9]{8})$',
  ])('does not compile an unsafe or unbounded Otros regex: %s', (otherIdentifierFormat) => {
    const unsafeConfig = { ...config, otherIdentifierFormat };

    expect(getEmergencyIdentityDocumentTypes(unsafeConfig)).not.toContainEqual(
      expect.objectContaining({ label: 'Otros' }),
    );
    expect(validateEmergencyIdentityDocument(unsafeConfig, 'other-uuid', 'AAAAAAAA').error).toMatch(
      /regla de validación aprobada/u,
    );
  });

  it('rejects and hides ambiguous identifier type UUIDs', () => {
    const ambiguousConfig = { ...config, foreignCardIdentifierTypeUuid: config.defaultIdentifierTypeUuid };

    expect(getEmergencyIdentityDocumentConfigurationError(ambiguousConfig)).toMatch(/mismo UUID/u);
    expect(getEmergencyIdentityDocumentTypes(ambiguousConfig)).not.toContainEqual(
      expect.objectContaining({ value: config.defaultIdentifierTypeUuid }),
    );
    expect(
      validateEmergencyIdentityDocument(ambiguousConfig, config.defaultIdentifierTypeUuid, '12345678').error,
    ).toMatch(/configuración.*ambigua/u);
  });

  it.each([
    ['dni-uuid', '12345678', '12345678'],
    ['ce-uuid', 'ab123456', 'AB123456'],
    ['passport-uuid', 'pa123456', 'PA123456'],
    ['die-uuid', 'die123456', 'DIE123456'],
    ['cnv-uuid', '123456789012', '123456789012'],
    ['other-uuid', 'ABC123', 'ABC123'],
  ])('normalizes a valid configured document type %s', (identifierTypeUuid, rawIdentifier, identifier) => {
    expect(validateEmergencyIdentityDocument(config, identifierTypeUuid, rawIdentifier)).toEqual({ identifier });
  });

  it.each([
    ['dni-uuid', '1234567'],
    ['ce-uuid', 'ABC12'],
    ['passport-uuid', 'ABC12'],
    ['die-uuid', 'ABC1234567890123'],
    ['cnv-uuid', '12345678901'],
    ['other-uuid', 'ABC-123'],
  ])('rejects an invalid configured document type %s', (identifierTypeUuid, identifier) => {
    expect(validateEmergencyIdentityDocument(config, identifierTypeUuid, identifier).error).toBeTruthy();
  });

  it('rejects an identifier type that is not in the configured catalog', () => {
    expect(validateEmergencyIdentityDocument(config, 'unknown-type', 'ABC123').error).toMatch(/regla de validación/u);
  });

  it('does not truncate an overlong Otros identifier into an apparently valid value', () => {
    const constrainedConfig = {
      ...config,
      otherIdentifierFormat: '^[A-Z0-9]{1,6}$',
      otherIdentifierMaxLength: 6,
    };

    expect(validateEmergencyIdentityDocument(constrainedConfig, 'other-uuid', 'ABC1234').error).toMatch(
      /formato institucional/u,
    );
  });
});
