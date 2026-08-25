import { getDefaultsFromConfigSchema } from '@openmrs/esm-framework';

import { esmPatientRegistrationSchema, type RegistrationConfig } from './config-schema';
import { defaultSisOnlineVerificationUrl } from './constants';

const approvedBulkImportConfig: RegistrationConfig['bulkPatientImport'] = {
  enabled: true,
  approvedFileSha256: 'a'.repeat(64),
  approvedBuildSha: 'b'.repeat(40),
  approvedOrigin: 'https://approved.example',
  approvalExpiresAt: '2026-08-22T00:00:00.000Z',
  approvedUserUuid: '11111111-1111-4111-8111-111111111111',
  approvedLocationUuid: '22222222-2222-4222-8222-222222222222',
  domicilioTarget: 'address4',
  maxRows: 250,
};

function getRootValidationErrors(config: RegistrationConfig): Array<string> {
  return esmPatientRegistrationSchema._validators
    .map((validate) => validate(config))
    .filter((result): result is string => typeof result === 'string');
}

describe('SIS verification configuration', () => {
  it('uses the SUSALUD portal by default', () => {
    const config = getDefaultsFromConfigSchema(esmPatientRegistrationSchema) as RegistrationConfig;

    expect(config.sisVerification.onlineVerificationUrl).toBe(defaultSisOnlineVerificationUrl);
    expect(getRootValidationErrors(config)).toEqual([]);
  });

  it('rejects non-HTTPS and malformed verification URLs', () => {
    const defaults = getDefaultsFromConfigSchema(esmPatientRegistrationSchema) as RegistrationConfig;

    for (const onlineVerificationUrl of ['http://example.com/sis', 'not-a-url']) {
      const config = {
        ...defaults,
        sisVerification: { ...defaults.sisVerification, onlineVerificationUrl },
      };

      expect(getRootValidationErrors(config)).toContain(
        '`sisVerification.onlineVerificationUrl` must be a valid HTTPS URL.',
      );
    }
  });
});

describe('bulk patient import configuration', () => {
  it('is disabled and has no approvals by default', () => {
    const config = getDefaultsFromConfigSchema(esmPatientRegistrationSchema) as RegistrationConfig;

    expect(config.bulkPatientImport).toEqual({
      enabled: false,
      approvedFileSha256: '',
      approvedBuildSha: '',
      approvedOrigin: '',
      approvalExpiresAt: '',
      approvedUserUuid: '',
      approvedLocationUuid: '',
      domicilioTarget: '',
      maxRows: 250,
    });
    expect(getRootValidationErrors(config)).toEqual([]);
  });

  it('accepts a fully approved enabled import', () => {
    const config = {
      ...(getDefaultsFromConfigSchema(esmPatientRegistrationSchema) as RegistrationConfig),
      bulkPatientImport: approvedBulkImportConfig,
    };

    expect(getRootValidationErrors(config)).toEqual([]);
  });

  it.each([
    ['approvedFileSha256', 'ABC'],
    ['approvedBuildSha', 'ABC'],
    ['approvedOrigin', 'https://approved.example/path'],
    ['approvalExpiresAt', ''],
    ['approvalExpiresAt', '2026-08-22T00:00:00Z'],
    ['approvedUserUuid', '1'.repeat(36)],
    ['approvedLocationUuid', '2'.repeat(36)],
    ['domicilioTarget', 'address1'],
  ] as const)('rejects an enabled import with an invalid %s', (field, value) => {
    const config = {
      ...(getDefaultsFromConfigSchema(esmPatientRegistrationSchema) as RegistrationConfig),
      bulkPatientImport: {
        ...approvedBulkImportConfig,
        [field]: value,
      },
    } as RegistrationConfig;

    expect(getRootValidationErrors(config)).toEqual([expect.stringContaining(`bulkPatientImport.${field}`)]);
  });
});
