import { useConfig } from '@openmrs/esm-framework';
import { fireEvent, render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';

import { type AdmissionRow, useAdmissions } from '../resources/admissions.resource';
import AdmissionHome from './admission-home.component';

vi.mock('@openmrs/esm-framework', async () => ({
  ...(await vi.importActual('@openmrs/esm-framework')),
  ageAsDuration: (await vi.importActual<typeof import('@openmrs/esm-utils')>('@openmrs/esm-utils')).ageAsDuration,
  useConfig: vi.fn(),
}));

vi.mock('@sihsalus/esm-rbac', () => ({
  AppErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  RequirePrivilege: ({ children }: { children: React.ReactNode }) => <>{children}</>,
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
  return screen.getByText(label).parentElement;
}

function createAdmission(overrides: Partial<AdmissionRow>): AdmissionRow {
  return {
    uuid: 'visit',
    patientUuid: 'patient',
    startDatetime: '2026-05-09T08:30:00.000-0500',
    patientName: 'Ada Lovelace',
    medicalRecordNumber: 'HC-99',
    documentNumber: '12345678',
    identificationStatus: 'Confirmado',
    communicationCondition: 'Puede comunicarse',
    responsibleName: 'Charles Babbage',
    responsibleRelationship: 'Familiar',
    birthDate: '1990-01-01',
    hasSis: 'Sí',
    address: 'Av. Peru 123, Lima, Lima',
    gender: 'F',
    service: 'Consulta externa',
    location: 'Admision Central',
    status: 'Activa',
    searchText: '',
    ...overrides,
  };
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
        createAdmission({
          uuid: 'visit-1',
          patientUuid: 'patient-1',
          patientName: 'Ada Lovelace',
          medicalRecordNumber: 'HC-99',
          documentNumber: '12345678',
          birthDate: '1990-01-01',
          hasSis: 'Sí',
          address: 'Av. Peru 123, Lima, Lima',
          gender: 'F',
          service: 'Consulta externa',
          status: 'Activa',
        }),
        createAdmission({
          uuid: 'visit-2',
          patientUuid: 'patient-2',
          startDatetime: '2026-05-09T10:00:00.000-0500',
          patientName: 'Grace Hopper',
          medicalRecordNumber: 'HC-100',
          documentNumber: '87654321',
          birthDate: '1985-03-02',
          hasSis: 'No',
          address: 'Jr. Amazonas 45, Iquitos, Loreto',
          gender: 'M',
          service: 'Emergencia',
          location: 'Topico',
          status: 'Finalizada',
        }),
      ],
      error: undefined,
      isLoading: false,
    });

    renderAdmissionHome();

    expect(screen.getByRole('heading', { name: /libro de atenciones/i })).toBeInTheDocument();
    for (const header of [
      'Fecha',
      'HCE / código temporal',
      'DNI',
      'Estado identificación',
      'Responsable',
      'F. Nac.',
      'Tiene SIS',
      'Nombres y apellidos',
      'Dirección',
      'Edad',
      'M',
      'F',
      'Servicio',
      'Número de orden',
      'Condición comunicación',
    ]) {
      expect(screen.getByRole('columnheader', { name: header })).toBeInTheDocument();
    }
    expect(screen.getByRole('cell', { name: 'Ada Lovelace' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'HC-99' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: '12345678' })).toBeInTheDocument();
    expect(screen.getAllByRole('cell', { name: 'Confirmado' })[0]).toBeInTheDocument();
    expect(screen.getAllByRole('cell', { name: 'Charles Babbage - Familiar' })[0]).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Sí' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Av. Peru 123, Lima, Lima' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Consulta externa' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: '1' })).toBeInTheDocument();
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

  it('renders age with year, month, and week units in the gender age columns', () => {
    mockUseAdmissions.mockReturnValue({
      admissions: [
        createAdmission({
          uuid: 'visit-years',
          gender: 'F',
          birthDate: '1990-06-18',
          startDatetime: '2026-06-18T08:30:00.000-0500',
        }),
        createAdmission({
          uuid: 'visit-months',
          gender: 'M',
          birthDate: '2025-06-16',
          startDatetime: '2026-06-18T08:30:00.000-0500',
        }),
        createAdmission({
          uuid: 'visit-weeks',
          gender: 'M',
          birthDate: '2026-05-28',
          startDatetime: '2026-06-18T08:30:00.000-0500',
        }),
      ],
      error: undefined,
      isLoading: false,
    });

    renderAdmissionHome();

    expect(screen.getByRole('cell', { name: '36 años' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: '12 meses' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: '3 semanas' })).toBeInTheDocument();
  });

  it('filters the report by search text and status', () => {
    mockUseAdmissions.mockReturnValue({
      admissions: [
        createAdmission({
          uuid: 'visit-1',
          patientUuid: 'patient-1',
          patientName: 'Ada Lovelace',
          documentNumber: '12345678',
          service: 'Consulta externa',
          status: 'Activa',
        }),
        createAdmission({
          uuid: 'visit-2',
          patientUuid: 'patient-2',
          patientName: 'Grace Hopper',
          documentNumber: '87654321',
          service: 'Emergencia',
          location: 'Topico',
          status: 'Finalizada',
        }),
      ],
      error: undefined,
      isLoading: false,
    });

    renderAdmissionHome();

    fireEvent.change(screen.getByRole('textbox', { name: /buscar por paciente/i }), { target: { value: '87654321' } });

    expect(screen.queryByRole('cell', { name: 'Ada Lovelace' })).not.toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Grace Hopper' })).toBeInTheDocument();
    expect(getMetricValue('Atenciones registradas')).toHaveTextContent('1');

    fireEvent.change(screen.getByLabelText(/filtrar por estado/i), { target: { value: 'Activa' } });

    expect(screen.queryByRole('cell', { name: 'Grace Hopper' })).not.toBeInTheDocument();
    expect(screen.getByText(/no se encontraron atenciones recientes/i)).toBeInTheDocument();
  });

  it('filters the report by HCE, temporal code, insurance code, and structured responsible data', () => {
    mockUseAdmissions.mockReturnValue({
      admissions: [
        createAdmission({
          uuid: 'visit-1',
          patientUuid: 'patient-1',
          patientName: 'Niño Prueba',
          medicalRecordNumber: 'TEMP-001',
          documentNumber: '77889900',
          responsibleName: 'María Quispe',
          responsibleRelationship: 'Madre',
          searchText: 'Código temporal TEMP-001 Código de Seguro SIS-183299 María Quispe Madre',
        }),
        createAdmission({
          uuid: 'visit-2',
          patientUuid: 'patient-2',
          patientName: 'Grace Hopper',
          medicalRecordNumber: 'HC-100',
          documentNumber: '87654321',
          responsibleName: 'Alan Hopper',
          responsibleRelationship: 'Familiar',
          searchText: 'Historia Clinica HC-100 Documento 87654321 Alan Hopper Familiar',
        }),
      ],
      error: undefined,
      isLoading: false,
    });

    renderAdmissionHome();

    const searchInput = screen.getByRole('textbox', { name: /buscar por paciente/i });
    for (const query of ['TEMP-001', 'SIS-183299', 'María Quispe', 'Madre']) {
      fireEvent.change(searchInput, { target: { value: query } });

      expect(screen.getByRole('cell', { name: 'Niño Prueba' })).toBeInTheDocument();
      expect(screen.queryByRole('cell', { name: 'Grace Hopper' })).not.toBeInTheDocument();
    }
  });

  it('exports an Excel-compatible UTF-8 CSV preserving Spanish characters', async () => {
    const createObjectURL = vi.fn((_blob: Blob | MediaSource) => 'blob:atenciones');
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectURL });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeObjectURL });

    mockUseAdmissions.mockReturnValue({
      admissions: [
        createAdmission({
          uuid: 'visit-1',
          patientUuid: 'patient-1',
          patientName: 'María Peña Ñaupari',
          medicalRecordNumber: 'TEMP-001',
          documentNumber: '',
          identificationStatus: 'Confirmado',
          communicationCondition: 'Sí comunica',
          responsibleName: 'José Quispe',
          responsibleRelationship: 'Padre',
          birthDate: '2019-06-01',
          hasSis: 'Sí',
          address: 'Jr. Unión 123, Huánuco',
          gender: 'F',
          service: 'Consulta ambulatoria',
          status: 'Activa',
        }),
      ],
      error: undefined,
      isLoading: false,
    });

    renderAdmissionHome();

    fireEvent.click(screen.getByRole('button', { name: /exportar csv/i }));

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    const blob = createObjectURL.mock.calls[0][0] as Blob;
    const csv = await blob.text();

    expect(csv.startsWith('\uFEFFsep=,\r\n')).toBe(true);
    expect(csv).toContain('"HCE / código temporal"');
    expect(csv).toContain('"Estado identificación"');
    expect(csv).toContain('"Condición comunicación"');
    expect(csv).toContain('"María Peña Ñaupari"');
    expect(csv).toContain('"Sí comunica"');
    expect(csv).toContain('"Jr. Unión 123, Huánuco"');
    expect(csv).toContain('"6 años"');
    expect(csv).not.toContain('Ã');
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:atenciones');
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
    expect(screen.getByText(/no se pudo cargar el libro de atenciones/i)).toBeInTheDocument();
    expect(screen.queryByText(/no se encontraron atenciones recientes/i)).not.toBeInTheDocument();
  });

  it('shows the empty state when no care encounters are returned after loading', () => {
    mockUseAdmissions.mockReturnValue({ admissions: [], error: undefined, isLoading: false });

    renderAdmissionHome();

    expect(screen.getByText(/no se encontraron atenciones recientes/i)).toBeInTheDocument();
  });
});
