import { fireEvent, render, screen } from '@testing-library/react';

import PatientMerge from './patient-merge.component';

describe('PatientMerge', () => {
  beforeEach(() => {
    globalThis.openmrsBase = '/openmrs';
  });

  it('renders the duplicate patient merge workflow mockup', () => {
    render(<PatientMerge />);

    expect(screen.getByRole('heading', { name: /fusionar historias clínicas duplicadas/i })).toBeInTheDocument();
    expect(screen.getByText(/dos historias clínicas pertenezcan al mismo paciente/i)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /abrir fusión de pacientes/i })).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /buscar/i })).toHaveLength(2);
  });

  it('shows candidates, lets the user select a pair, and opens the review step', () => {
    render(<PatientMerge />);

    fireEvent.click(screen.getAllByRole('button', { name: /buscar/i })[1]);

    expect(screen.getByRole('heading', { name: /pacientes devueltos/i })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: '10000KP' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: '10000JT' })).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Seleccionar paciente', { selector: '#merge-patient-16' }));
    fireEvent.click(screen.getByLabelText('Seleccionar paciente', { selector: '#merge-patient-15' }));
    fireEvent.click(screen.getByRole('button', { name: /continuar/i }));

    expect(screen.getByText(/revise la combinacion con cuidado/i)).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /armando mendoza - 10000kp/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /fusionar historias/i })).toBeDisabled();

    fireEvent.click(screen.getByRole('radio', { name: /armando mendoza - 10000kp/i }));

    expect(screen.getByRole('button', { name: /fusionar historias/i })).toBeEnabled();
  });
});
