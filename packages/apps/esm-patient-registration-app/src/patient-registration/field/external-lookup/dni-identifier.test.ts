import type { PatientIdentifierType, PatientIdentifierValue } from '../../patient-registration.types';
import {
  peruDniPatientIdentifierTypeUuid,
  peruPassportPatientIdentifierTypeUuid,
  peruTemporaryAffiliationPatientIdentifierTypeUuid,
} from '../../peru-registration-config';
import {
  getDocumentIdentifierEntries,
  getDocumentIdentifierEntry,
  isValidIdentityIdentifier,
  normalizeIdentityIdentifier,
} from './dni-identifier';

describe('civil document identifiers', () => {
  const identifiers = {
    dni: {
      identifierTypeUuid: peruDniPatientIdentifierTypeUuid,
      identifierValue: '12345678',
    },
    emptyPassport: {
      identifierTypeUuid: peruPassportPatientIdentifierTypeUuid,
      identifierValue: '   ',
    },
    passport: {
      identifierTypeUuid: peruPassportPatientIdentifierTypeUuid,
      identifierValue: 'PA-1234',
    },
    temporaryAffiliation: {
      identifierTypeUuid: peruTemporaryAffiliationPatientIdentifierTypeUuid,
      identifierValue: 'E-41267525',
    },
    systemId: {
      identifierTypeUuid: '05a29f94-c0ed-11e2-94be-8c13b969e334',
      identifierValue: '10000001',
    },
  } as unknown as Record<string, PatientIdentifierValue>;

  const identifierTypes = Object.entries(identifiers).map(([fieldName, identifier]) => ({
    fieldName,
    name: fieldName,
    uuid: identifier.identifierTypeUuid,
  })) as Array<PatientIdentifierType>;

  it('returns every populated civil document and excludes internal identifiers', () => {
    expect(getDocumentIdentifierEntries(identifiers, identifierTypes).map(([fieldName]) => fieldName)).toEqual([
      'dni',
      'passport',
      'temporaryAffiliation',
    ]);
  });

  it('keeps the first-document helper for the interactive lookup', () => {
    expect(getDocumentIdentifierEntry(identifiers, identifierTypes)?.[0]).toBe('dni');
  });

  it('preserves and validates the canonical E-######## identity reference', () => {
    const temporaryType = identifierTypes.find(
      ({ uuid }) => uuid === peruTemporaryAffiliationPatientIdentifierTypeUuid,
    );
    const normalized = normalizeIdentityIdentifier(
      'e 4126-7525',
      peruTemporaryAffiliationPatientIdentifierTypeUuid,
      'Afiliación temporal SIS',
      temporaryType,
    );

    expect(normalized).toBe('E-41267525');
    expect(
      isValidIdentityIdentifier(
        normalized,
        peruTemporaryAffiliationPatientIdentifierTypeUuid,
        'Afiliación temporal SIS',
        temporaryType,
      ),
    ).toBe(true);

    const overlong = normalizeIdentityIdentifier(
      'E-123456789',
      peruTemporaryAffiliationPatientIdentifierTypeUuid,
      'Afiliación temporal SIS',
      temporaryType,
    );
    expect(overlong).toBe('E-123456789');
    expect(
      isValidIdentityIdentifier(
        overlong,
        peruTemporaryAffiliationPatientIdentifierTypeUuid,
        'Afiliación temporal SIS',
        temporaryType,
      ),
    ).toBe(false);
  });
});
