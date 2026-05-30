import { render, screen } from '@testing-library/react';

import PatientMerge from './patient-merge.component';

describe('PatientMerge', () => {
  beforeEach(() => {
    globalThis.openmrsBase = '/openmrs';
  });

  it('renders the duplicate patient merge entry point and links to legacy OpenMRS', () => {
    render(<PatientMerge />);

    expect(screen.getByRole('heading', { name: /fusionar historias clínicas duplicadas/i })).toBeInTheDocument();
    expect(screen.getByText(/dos historias clínicas pertenezcan al mismo paciente/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /abrir fusión de pacientes/i })).toHaveAttribute(
      'href',
      '/openmrs/admin/patients/mergePatients.form',
    );
  });
});
