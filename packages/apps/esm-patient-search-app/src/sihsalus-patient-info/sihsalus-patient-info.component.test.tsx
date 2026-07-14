import { ExtensionSlot } from '@openmrs/esm-framework';
import { render, screen } from '@testing-library/react';

import { SihsalusPatientInfo } from './sihsalus-patient-info.component';

const mockExtensionSlot = vi.mocked(ExtensionSlot);

const patient = {
  birthDate: '1990-01-01',
  gender: 'female',
  id: 'patient-uuid',
  identifier: [
    {
      type: {
        coding: [{ code: '05a29f94-c0ed-11e2-94be-8c13b969e334' }],
        text: 'Historia Clinica',
      },
      value: '100005I',
    },
    {
      type: {
        coding: [{ code: '550e8400-e29b-41d4-a716-446655440001' }],
        text: 'DNI',
      },
      value: '79000001',
    },
  ],
  name: [{ text: 'Lucia Quispe' }],
  resourceType: 'Patient',
} as fhir.Patient;

describe('SihsalusPatientInfo', () => {
  beforeEach(() => {
    mockExtensionSlot.mockImplementation(() => null);
  });

  it('highlights and displays DNI before the clinical history identifier', () => {
    render(<SihsalusPatientInfo patient={patient} renderedFrom="patient-search" />);

    const dni = screen.getByText('79000001');
    const clinicalHistory = screen.getByText('100005I');

    expect(dni.tagName).toBe('STRONG');
    expect(clinicalHistory.tagName).toBe('SPAN');
    expect(dni.compareDocumentPosition(clinicalHistory) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
