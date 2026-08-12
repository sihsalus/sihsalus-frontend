import { formatCivilDocumentIdentifier, formatPatientIdentifiers } from './patient-identifiers';

describe('formatPatientIdentifiers', () => {
  it('merges and orders supported OpenMRS and FHIR identifiers', () => {
    expect(
      formatPatientIdentifiers(
        [
          { identifier: '87654321', identifierName: 'DNI' },
          { identifier: '100009C', identifierName: 'N° Historia Clínica' },
          { identifier: 'internal-id', identifierName: 'OpenMRS ID' },
        ],
        [
          { value: 'PAS123456', type: { text: 'Pasaporte' } },
          { value: '123456789012', type: { coding: [{ display: 'Certificado de Nacido Vivo' }] } },
        ],
      ),
    ).toBe('HC: 100009C; DNI: 87654321; PASS: PAS123456; CNV: 123456789012');
  });

  it('uses the type names supplied by the backend and removes duplicates', () => {
    expect(
      formatPatientIdentifiers(
        [
          {
            identifier: 'ABC123456',
            identifierType: { uuid: 'backend-defined-uuid', display: 'Carné de Extranjería' },
          },
        ],
        [
          {
            value: 'ABC123456',
            type: { coding: [{ code: 'backend-defined-code', display: 'CE' }] },
          },
          { value: 'CV-987', type: { text: 'CV' } },
        ],
      ),
    ).toBe('CE: ABC123456; CV: CV-987');
  });

  it('uses the appointment fallback only when no supported typed identifier is available', () => {
    expect(formatPatientIdentifiers([], [], '  10000NH  ')).toBe('10000NH');
    expect(formatPatientIdentifiers([{ identifier: 'internal-id', identifierName: 'OpenMRS ID' }], [], '10000NH')).toBe(
      '10000NH',
    );
    expect(formatPatientIdentifiers(null, null, '10001AA')).toBe('10001AA');
  });
});

describe('formatCivilDocumentIdentifier', () => {
  it('returns the preferred civil document with its type and excludes the clinical-history number', () => {
    expect(
      formatCivilDocumentIdentifier([
        { identifier: '100009C', identifierName: 'N° Historia Clínica' },
        { identifier: 'CE-123456', identifierName: 'Carné de Extranjería' },
      ]),
    ).toBe('CE - CE-123456');
  });

  it('uses supported FHIR document types when the appointment payload does not include them', () => {
    expect(
      formatCivilDocumentIdentifier([], [{ value: 'PAS123456', type: { text: 'Pasaporte' } }], {
        PASS: 'Passport',
      }),
    ).toBe('Passport - PAS123456');
  });

  it('recognizes Peru document types when the backend only supplies their UUIDs', () => {
    expect(
      formatCivilDocumentIdentifier(
        [
          {
            identifier: 'CE-123456',
            identifierType: { uuid: '550e8400-e29b-41d4-a716-446655440002' },
          },
        ],
        [
          {
            value: '87654321',
            type: { coding: [{ code: '550e8400-e29b-41d4-a716-446655440001' }] },
          },
        ],
      ),
    ).toBe('DNI - 87654321');
  });

  it('does not present internal or clinical-history identifiers as identity documents', () => {
    expect(
      formatCivilDocumentIdentifier([
        { identifier: '100009C', identifierName: 'N° Historia Clínica' },
        { identifier: 'internal-id', identifierName: 'OpenMRS ID' },
      ]),
    ).toBe('');
  });
});
