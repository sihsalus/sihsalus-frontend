import { ExtensionSlot } from '@openmrs/esm-framework';
import { render, screen } from '@testing-library/react';

import { SihsalusPatientInfo } from './sihsalus-patient-info.component';

const mockExtensionSlot = vi.mocked(ExtensionSlot);

describe('SihsalusPatientInfo', () => {
  beforeEach(() => {
    mockExtensionSlot.mockImplementation(() => null);
  });

  it('shows the DNI but omits the clinical history identifier from the compact banner', () => {
    const patient = {
      birthDate: '1990-01-01',
      gender: 'female',
      id: 'patient-uuid',
      identifier: [
        {
          type: { coding: [{ code: 'clinical-history-type' }], text: 'N° Historia Clínica' },
          value: '10000JT',
        },
        {
          type: { coding: [{ code: '550e8400-e29b-41d4-a716-446655440001' }], text: 'DNI' },
          value: '79000001',
        },
      ],
      name: [{ text: 'Lucía Quispe' }],
      resourceType: 'Patient',
    } as fhir.Patient;

    render(<SihsalusPatientInfo patient={patient} />);

    expect(screen.getByText('79000001')).toBeInTheDocument();
    expect(screen.queryByText('10000JT')).not.toBeInTheDocument();
    expect(screen.queryByText(/Historia Clínica/i)).not.toBeInTheDocument();
  });
});
