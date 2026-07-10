import { usePatient } from '@openmrs/esm-framework';
import { fireEvent, render, screen, within } from '@testing-library/react';

import TpedReferenceWidget from './tped-reference-widget.component';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, defaultValue: string, values?: Record<string, string | number>) =>
      Object.entries(values ?? {}).reduce(
        (translation, [key, value]) => translation.replaceAll(`{{${key}}}`, String(value)),
        defaultValue,
      ),
  }),
}));

const mockUsePatient = vi.mocked(usePatient);

function mockPatient(birthDate?: string) {
  mockUsePatient.mockReturnValue({
    patient: birthDate ? ({ birthDate } as fhir.Patient) : ({ id: 'patient-1' } as fhir.Patient),
    patientUuid: 'patient-1',
  } as ReturnType<typeof usePatient>);
}

describe('TpedReferenceWidget', () => {
  beforeEach(() => {
    mockPatient('2026-06-10');
  });

  it('renders the complete reference matrix without clinical save actions', () => {
    render(<TpedReferenceWidget evaluationDate="2026-07-10" patientUuid="patient-1" />);

    expect(screen.getByRole('heading', { name: /Test Peruano de Evaluación/i })).toBeInTheDocument();
    expect(screen.getByText('Histórico')).toBeInTheDocument();
    expect(screen.getByText('Solo referencia')).toBeInTheDocument();
    expect(screen.getByText(/NTS 238 vigente utiliza Huanca Test y EDI/i)).toBeInTheDocument();

    const matrix = screen.getByRole('table', { name: /Matriz de hitos/i });
    expect(within(matrix).getAllByRole('row')).toHaveLength(13);
    expect(screen.getByRole('combobox', { name: /Columna enfocada/i })).toHaveValue('1');
    expect(screen.queryByRole('button', { name: /guardar/i })).not.toBeInTheDocument();
  });

  it('opens direct and inherited milestone details from the matrix', () => {
    render(<TpedReferenceWidget evaluationDate="2026-07-10" patientUuid="patient-1" />);

    fireEvent.click(screen.getByRole('button', { name: /A1.*Hito de 1 mes/i }));
    expect(screen.getByRole('heading', { name: /Movimientos asimétricos/i })).toBeInTheDocument();
    expect(screen.getByText('Concepto pendiente')).toBeInTheDocument();

    fireEvent.change(screen.getByRole('combobox', { name: /Columna enfocada/i }), { target: { value: '6' } });
    fireEvent.click(screen.getByRole('button', { name: /A5.*Continúa en 6 meses/i }));

    expect(screen.getByText(/conserva el hito de 5 meses/i)).toBeInTheDocument();
  });

  it('shows an explicit state when no patient age can be calculated', () => {
    mockPatient();

    render(<TpedReferenceWidget evaluationDate="2026-07-10" patientUuid="patient-1" />);

    expect(screen.getByText('No disponible')).toBeInTheDocument();
  });

  it('warns when the patient is older than the historical instrument range', () => {
    mockPatient('2020-01-01');

    render(<TpedReferenceWidget evaluationDate="2026-07-10" patientUuid="patient-1" />);

    expect(screen.getByRole('status')).toHaveTextContent(/fuera del rango de 0 a 30 meses/i);
  });
});
