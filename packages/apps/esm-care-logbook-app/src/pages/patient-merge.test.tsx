import { render, screen } from '@testing-library/react';
import { navigate } from '@openmrs/esm-framework';

import PatientMerge, { getLegacyPatientMergeUrl } from './patient-merge.component';

vi.mock('@openmrs/esm-framework', () => ({
  navigate: vi.fn(),
}));

const mockNavigate = vi.mocked(navigate);

describe('PatientMerge', () => {
  beforeEach(() => {
    globalThis.openmrsBase = '/openmrs';
    mockNavigate.mockClear();
  });

  it('redirects the SPA route to the legacy OpenMRS duplicate patient search page', () => {
    render(<PatientMerge />);

    expect(screen.getByRole('heading', { name: /fusionar historias clínicas duplicadas/i })).toBeInTheDocument();
    expect(screen.getByText(/dos historias clínicas pertenezcan al mismo paciente/i)).toBeInTheDocument();
    expect(mockNavigate).toHaveBeenCalledWith({ to: '/openmrs/admin/patients/findDuplicatePatients.htm' });
    expect(screen.getByRole('link', { name: /abrir fusión de pacientes/i })).toHaveAttribute(
      'href',
      '/openmrs/admin/patients/findDuplicatePatients.htm',
    );
    expect(screen.queryByRole('button', { name: /buscar/i })).not.toBeInTheDocument();
  });

  it('normalizes OpenMRS base paths before building the legacy merge URL', () => {
    expect(getLegacyPatientMergeUrl('/openmrs/')).toBe('/openmrs/admin/patients/findDuplicatePatients.htm');
  });
});
