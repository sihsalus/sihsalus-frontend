import { getEmergencyIdentityDocumentTypes } from './emergency-identity-documents';

describe('getEmergencyIdentityDocumentTypes', () => {
  it('includes the generic Otros identifier required by the emergency workflow', () => {
    const identifierTypes = getEmergencyIdentityDocumentTypes({
      defaultIdentifierTypeUuid: 'dni-uuid',
      dieIdentifierTypeUuid: 'die-uuid',
      foreignCardIdentifierTypeUuid: 'ce-uuid',
      liveBirthCertificateIdentifierTypeUuid: 'cnv-uuid',
      otherIdentifierTypeUuid: 'other-uuid',
      passportIdentifierTypeUuid: 'passport-uuid',
    });

    expect(identifierTypes).toEqual([
      { label: 'DNI', value: 'dni-uuid' },
      { label: 'CE', value: 'ce-uuid' },
      { label: 'Pasaporte', value: 'passport-uuid' },
      { label: 'Cédula de Identidad', value: 'die-uuid' },
      { label: 'CNV', value: 'cnv-uuid' },
      { label: 'Otros', value: 'other-uuid' },
    ]);
  });
});
