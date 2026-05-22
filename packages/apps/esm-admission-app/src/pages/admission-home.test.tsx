import { useConfig } from '@openmrs/esm-framework';
import { fireEvent, render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';

import { useAdmissions } from '../resources/admissions.resource';
import AdmissionHome from './admission-home.component';

vi.mock('@openmrs/esm-framework', async () => ({
  ...(await vi.importActual('@openmrs/esm-framework')),
  useConfig: vi.fn(),
}));

vi.mock('../resources/admissions.resource', () => ({
  useAdmissions: vi.fn(),
}));

const mockUseAdmissions = vi.mocked(useAdmissions);
const mockUseConfig = vi.mocked(useConfig);

function renderAdmissionHome() {
  return render(
    <BrowserRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
      <AdmissionHome />
    </BrowserRouter>,
  );
}

function getMetricValue(label: string) {
  return screen.getByText(label).parentElement?.querySelector('strong');
}

describe('AdmissionHome', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.pushState({}, '', '/');
    globalThis.getOpenmrsSpaBase = vi.fn(() => '/openmrs/spa/');
    mockUseConfig.mockReturnValue({ admissionReportPageSize: 75 });
  });

  it('renders the care encounters by UPSS report with accreditation columns', () => {
    mockUseAdmissions.mockReturnValue({
      admissions: [
        {
          uuid: 'visit-1',
          patientUuid: 'patient-1',
          startDatetime: '2026-05-09T08:30:00.000-0500',
          patientName: 'Ada Lovelace',
          medicalRecordNumber: 'HC-99',
          service: 'Consulta externa',
          location: 'Admision Central',
          status: 'Activa',
        },
        {
          uuid: 'visit-2',
          patientUuid: 'patient-2',
          startDatetime: '2026-05-09T10:00:00.000-0500',
          patientName: 'Grace Hopper',
          medicalRecordNumber: 'HC-100',
          service: 'Emergencia',
          location: 'Topico',
          status: 'Finalizada',
        },
      ],
      error: undefined,
      isLoading: false,
    });

    renderAdmissionHome();

    expect(screen.getByRole('heading', { name: /registro de atenciones/i })).toBeInTheDocument();
    for (const header of ['Fecha', 'Hora', 'Paciente', 'HC', 'UPSS/servicio', 'Ubicación', 'Estado']) {
      expect(screen.getByRole('columnheader', { name: header })).toBeInTheDocument();
    }
    expect(screen.getByRole('cell', { name: 'Ada Lovelace' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'HC-99' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Consulta externa' })).toBeInTheDocument();
    expect(getMetricValue('Atenciones registradas')).toHaveTextContent('2');
    expect(getMetricValue('En curso')).toHaveTextContent('1');
    expect(getMetricValue('Finalizadas')).toHaveTextContent('1');
    expect(getMetricValue('UPSS/servicios')).toHaveTextContent('2');
    expect(screen.getByRole('link', { name: /fusionar historias duplicadas/i })).toHaveAttribute(
      'href',
      '/openmrs/spa/admission/merge',
    );
    expect(mockUseAdmissions).toHaveBeenCalledWith(75);
  });

  it('filters the report by search text and status', () => {
    mockUseAdmissions.mockReturnValue({
      admissions: [
        {
          uuid: 'visit-1',
          patientUuid: 'patient-1',
          patientName: 'Ada Lovelace',
          medicalRecordNumber: 'HC-99',
          service: 'Consulta externa',
          location: 'Admision Central',
          status: 'Activa',
        },
        {
          uuid: 'visit-2',
          patientUuid: 'patient-2',
          patientName: 'Grace Hopper',
          medicalRecordNumber: 'HC-100',
          service: 'Emergencia',
          location: 'Topico',
          status: 'Finalizada',
        },
      ],
      error: undefined,
      isLoading: false,
    });

    renderAdmissionHome();

    fireEvent.change(screen.getByRole('textbox', { name: /buscar por paciente/i }), { target: { value: 'Grace' } });

    expect(screen.queryByRole('cell', { name: 'Ada Lovelace' })).not.toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Grace Hopper' })).toBeInTheDocument();
    expect(getMetricValue('Atenciones registradas')).toHaveTextContent('1');

    fireEvent.change(screen.getByLabelText(/filtrar por estado/i), { target: { value: 'Activa' } });

    expect(screen.queryByRole('cell', { name: 'Grace Hopper' })).not.toBeInTheDocument();
    expect(screen.getByText(/no se encontraron atenciones recientes/i)).toBeInTheDocument();
  });

  it('uses the default report page size when config is empty', () => {
    mockUseConfig.mockReturnValue({});
    mockUseAdmissions.mockReturnValue({ admissions: [], error: undefined, isLoading: false });

    renderAdmissionHome();

    expect(mockUseAdmissions).toHaveBeenCalledWith(50);
  });

  it('shows loading and error states', () => {
    mockUseAdmissions.mockReturnValue({ admissions: [], error: new Error('boom'), isLoading: true });

    renderAdmissionHome();

    expect(screen.getByText(/cargando atenciones/i)).toBeInTheDocument();
    expect(screen.getByText(/no se pudo cargar el registro de atenciones/i)).toBeInTheDocument();
    expect(screen.queryByText(/no se encontraron atenciones recientes/i)).not.toBeInTheDocument();
  });

  it('shows the empty state when no care encounters are returned after loading', () => {
    mockUseAdmissions.mockReturnValue({ admissions: [], error: undefined, isLoading: false });

    renderAdmissionHome();

    expect(screen.getByText(/no se encontraron atenciones recientes/i)).toBeInTheDocument();
  });
});
