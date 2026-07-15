import type { PatientIdentifierType, PatientIdentifierValue } from '../../patient-registration.types';
import {
  peruDniPatientIdentifierTypeUuid,
  peruPassportPatientIdentifierTypeUuid,
} from '../../peru-registration-config';
import { getDocumentIdentifierEntries, getDocumentIdentifierEntry } from './dni-identifier';

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
    ]);
  });

  it('keeps the first-document helper for the interactive lookup', () => {
    expect(getDocumentIdentifierEntry(identifiers, identifierTypes)?.[0]).toBe('dni');
  });
});
