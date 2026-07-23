import { launchWorkspace2 } from '@openmrs/esm-framework';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import {
  usePatientDetail,
  usePatientUpcomingAppointments,
  usePatientVisitHistory,
} from '../resources/admissions.resource';
import PatientAdmissionDetail from './patient-admission-detail.component';

vi.mock('@openmrs/esm-framework', async () => ({
  ...(await vi.importActual('@openmrs/esm-framework')),
  launchWorkspace2: vi.fn(),
}));

vi.mock('../resources/admissions.resource', () => ({
  usePatientDetail: vi.fn(),
  usePatientUpcomingAppointments: vi.fn(),
  usePatientVisitHistory: vi.fn(),
}));

const mockLaunchWorkspace2 = vi.mocked(launchWorkspace2);
const mockUsePatientDetail = vi.mocked(usePatientDetail);
const mockUsePatientUpcomingAppointments = vi.mocked(usePatientUpcomingAppointments);
const mockUsePatientVisitHistory = vi.mocked(usePatientVisitHistory);

function renderPatientAdmissionDetail(route = '/patient/patient-uuid') {
  return render(
    <MemoryRouter initialEntries={[route]} future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
      <Routes>
        <Route path="/patient/:patientUuid" element={<PatientAdmissionDetail />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('PatientAdmissionDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.i18next.language = 'es';
    mockUsePatientDetail.mockReturnValue({
      patient: {
        person: {
          display: 'Ada Lovelace',
          birthdate: '1990-01-01',
          birthdateEstimated: true,
          gender: 'F',
          age: 36,
          addresses: [{ preferred: true, address1: 'Av. Peru 123', cityVillage: 'Lima', stateProvince: 'Lima' }],
          attributes: [
            { attributeType: { display: 'Grupo sanguineo' }, value: { display: 'O' } },
            { attributeType: { display: 'Factor Rh' }, value: 'Positivo' },
            { value: 'Sin etiqueta' },
          ],
        },
        identifiers: [
          { identifier: 'HC-99', identifierType: { display: 'Historia clinica' }, preferred: true },
          { identifier: '12345678', identifierType: { display: 'DNI' } },
        ],
      },
      error: undefined,
      isLoading: false,
    });
    mockUsePatientVisitHistory.mockReturnValue({
      visits: [
        {
          uuid: 'visit-1',
          startDatetime: '2026-05-09T08:30:00.000-0500',
          service: 'Consulta externa',
          location: 'Admision Central',
          status: 'Activa',
        },
      ],
      error: undefined,
      isLoading: false,
    });
    mockUsePatientUpcomingAppointments.mockReturnValue({
      appointments: [
        {
          uuid: 'appointment-1',
          startDateTime: '2099-05-10T10:00:00.000-05:00',
          endDateTime: '2099-05-10T10:30:00.000-05:00',
          service: 'Medicina general',
          provider: 'Dra. Torres',
          location: 'Consultorio 1',
          status: 'Scheduled',
        },
      ],
      error: undefined,
      isLoading: false,
    });
  });

  it('renders filiation data separated from visit/admission history and appointment scheduling', () => {
    renderPatientAdmissionDetail();

    expect(screen.getByRole('link', { name: /volver a atenciones/i })).toHaveAttribute('href', '/');
    expect(screen.getByRole('heading', { name: 'Ada Lovelace' })).toBeInTheDocument();
    expect(screen.getByTestId('filiation-section')).toBeInTheDocument();
    expect(screen.getByText(/person — separado de datos clínicos/i)).toBeInTheDocument();
    expect(screen.getByText('Historia clinica: HC-99 · DNI: 12345678')).toBeInTheDocument();
    expect(screen.getByText(/estimada/i)).toBeInTheDocument();
    expect(screen.getByText(/36 años 6 meses \d+ días/)).toBeInTheDocument();
    expect(screen.getByText('Femenino')).toBeInTheDocument();
    expect(screen.getByText('Av. Peru 123, Lima, Lima')).toBeInTheDocument();
    expect(screen.getByText('Grupo sanguineo')).toBeInTheDocument();
    expect(screen.getByText('O')).toBeInTheDocument();
    expect(screen.getByText('Factor Rh')).toBeInTheDocument();
    expect(screen.getByText('Positivo')).toBeInTheDocument();
    expect(screen.queryByText('Sin etiqueta')).not.toBeInTheDocument();

    expect(screen.getByTestId('admission-history-section')).toBeInTheDocument();
    expect(screen.getByText(/visit\/encounter — datos clínicos/i)).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Tipo de visita' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Servicio' })).toBeInTheDocument();
    expect(screen.getAllByRole('columnheader', { name: 'UPSS' })).toHaveLength(2);
    expect(screen.getByRole('cell', { name: 'Consulta externa' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Admision Central' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Activa' })).toBeInTheDocument();

    expect(screen.getByTestId('appointment-scheduling-section')).toBeInTheDocument();
    expect(screen.getByText(/solicitudes\/cupos\/prestadores/i)).toBeInTheDocument();
    expect(screen.getByText(/consultar disponibilidad, seleccionar cupo y registrar citas/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /programar turno/i })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Medicina general' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Dra. Torres' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Consultorio 1' })).toBeInTheDocument();

    expect(mockUsePatientDetail).toHaveBeenCalledWith('patient-uuid');
    expect(mockUsePatientVisitHistory).toHaveBeenCalledWith('patient-uuid');
    expect(mockUsePatientUpcomingAppointments).toHaveBeenCalledWith('patient-uuid');
  });

  it('launches the real appointments workspace with the selected patient', async () => {
    const user = userEvent.setup();
    renderPatientAdmissionDetail();

    await user.click(screen.getByRole('button', { name: /programar turno/i }));

    expect(mockLaunchWorkspace2).toHaveBeenCalledWith('appointments-form-workspace', {
      context: 'creating',
      patientUuid: 'patient-uuid',
      workspaceTitle: 'Programar turno',
    });
  });

  it('shows loading and patient error states', () => {
    mockUsePatientDetail.mockReturnValue({ patient: null, error: new Error('boom'), isLoading: true });
    mockUsePatientVisitHistory.mockReturnValue({ visits: [], error: undefined, isLoading: false });
    mockUsePatientUpcomingAppointments.mockReturnValue({ appointments: [], error: undefined, isLoading: false });

    renderPatientAdmissionDetail();

    expect(screen.getByText(/cargando paciente/i)).toBeInTheDocument();
    expect(screen.getByText(/no se pudo cargar el paciente/i)).toBeInTheDocument();
  });

  it('shows visit loading, error, and empty states', () => {
    mockUsePatientVisitHistory.mockReturnValueOnce({ visits: [], error: undefined, isLoading: true });
    const { rerender } = renderPatientAdmissionDetail();
    expect(screen.getByText(/cargando historial de ingresos/i)).toBeInTheDocument();

    mockUsePatientVisitHistory.mockReturnValueOnce({ visits: [], error: new Error('boom'), isLoading: false });
    rerender(
      <MemoryRouter
        initialEntries={['/patient/patient-uuid']}
        future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
      >
        <Routes>
          <Route path="/patient/:patientUuid" element={<PatientAdmissionDetail />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText(/no se pudo cargar el historial de ingresos/i)).toBeInTheDocument();

    mockUsePatientVisitHistory.mockReturnValueOnce({ visits: [], error: undefined, isLoading: false });
    rerender(
      <MemoryRouter
        initialEntries={['/patient/patient-uuid']}
        future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
      >
        <Routes>
          <Route path="/patient/:patientUuid" element={<PatientAdmissionDetail />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText(/sin historial de ingresos registrado/i)).toBeInTheDocument();
  });

  it('shows appointment loading, error, and empty states', () => {
    mockUsePatientUpcomingAppointments.mockReturnValueOnce({
      appointments: [],
      error: undefined,
      isLoading: true,
    });
    const { rerender } = renderPatientAdmissionDetail();
    expect(screen.getByText(/cargando turnos/i)).toBeInTheDocument();

    mockUsePatientUpcomingAppointments.mockReturnValueOnce({
      appointments: [],
      error: new Error('boom'),
      isLoading: false,
    });
    rerender(
      <MemoryRouter
        initialEntries={['/patient/patient-uuid']}
        future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
      >
        <Routes>
          <Route path="/patient/:patientUuid" element={<PatientAdmissionDetail />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText(/no se pudo cargar la programación de turnos/i)).toBeInTheDocument();

    mockUsePatientUpcomingAppointments.mockReturnValueOnce({
      appointments: [],
      error: undefined,
      isLoading: false,
    });
    rerender(
      <MemoryRouter
        initialEntries={['/patient/patient-uuid']}
        future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
      >
        <Routes>
          <Route path="/patient/:patientUuid" element={<PatientAdmissionDetail />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText(/sin turnos próximos registrados/i)).toBeInTheDocument();
  });
});
