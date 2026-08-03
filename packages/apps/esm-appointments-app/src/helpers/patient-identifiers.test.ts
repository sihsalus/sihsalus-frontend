import { formatPatientIdentifiers } from './patient-identifiers';

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
