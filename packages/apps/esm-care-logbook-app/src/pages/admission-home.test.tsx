import { useConfig } from '@openmrs/esm-framework';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { type PropsWithChildren } from 'react';
import { BrowserRouter } from 'react-router-dom';

import { type AdmissionRow, useAdmissions } from '../resources/admissions.resource';
import AdmissionHome from './admission-home.component';

vi.mock('@openmrs/esm-framework', async () => ({
  ...(await vi.importActual('@openmrs/esm-framework')),
  ConfigurableLink: ({ children, to }: PropsWithChildren<{ to: string }>) => <a href={to}>{children}</a>,
  EmptyCardIllustration: () => <svg />,
  PageHeader: ({ children }: PropsWithChildren) => <header>{children}</header>,
  PageHeaderContent: ({ children }: PropsWithChildren) => <div>{children}</div>,
  RegistrationPictogram: () => <span />,
  useConfig: vi.fn(),
}));

vi.mock('@sihsalus/esm-rbac', () => ({
  AppErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  RequirePrivilege: ({ children, privilege }: { children: React.ReactNode; privilege: string | string[] }) => (
    <div data-required-privileges={Array.isArray(privilege) ? privilege.join(',') : privilege}>{children}</div>
  ),
}));

vi.mock('../resources/admissions.resource', () => ({
  useAdmissions: vi.fn(),
}));

const mockUseAdmissions = vi.mocked(useAdmissions);
const mockUseConfig = vi.mocked(useConfig);

function renderAdmissionHome() {
  return render(
    <BrowserRouter>
      <AdmissionHome />
    </BrowserRouter>,
  );
}

function getMetricValue(label: string) {
  return within(screen.getByRole('region', { name: 'Métricas del libro de atenciones' })).getByText(label)
    .parentElement;
}

function createAdmission(overrides: Partial<AdmissionRow>): AdmissionRow {
  return {
    uuid: 'visit',
    patientUuid: 'patient',
    startDatetime: '2026-05-09T08:30:00.000-0500',
    patientName: 'Ada Lovelace',
    medicalRecordNumber: 'HC-99',
    documentType: 'DNI',
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
    window.i18next.language = 'es';
    window.history.pushState({}, '', '/');
    globalThis.getOpenmrsSpaBase = vi.fn(() => '/openmrs/spa/');
    mockUseConfig.mockReturnValue({ admissionReportPageSize: 75 });
  });

  it('starts with today in Lima and makes the historical choices explicit', () => {
    mockUseAdmissions.mockReturnValue({ admissions: [], error: undefined, isLoading: false });
    renderAdmissionHome();
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Lima',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
    const [year, month, day] = today.split('-').map(Number);
    const thirtyDaysStart = new Date(Date.UTC(year, month - 1, day - 29)).toISOString().slice(0, 10);
    expect(mockUseAdmissions).toHaveBeenLastCalledWith(75, { from: today, to: today }, true);
    fireEvent.change(screen.getByLabelText('Periodo'), { target: { value: 'range' } });
    expect(screen.getByLabelText('Desde')).toHaveValue(thirtyDaysStart);
    expect(screen.getByLabelText('Hasta')).toHaveValue(today);
    expect(mockUseAdmissions).toHaveBeenLastCalledWith(75, { from: thirtyDaysStart, to: today }, true);
    expect(screen.getByRole('button', { name: 'Limpiar filtros' })).toBeEnabled();
    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-01-01' } });
    fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '2026-01-31' } });
    expect(mockUseAdmissions).toHaveBeenLastCalledWith(75, { from: '2026-01-01', to: '2026-01-31' }, true);
    fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '2025-12-31' } });
    expect(mockUseAdmissions).toHaveBeenLastCalledWith(75, { from: '2026-01-01', to: '2025-12-31' }, false);
    expect(screen.getByText('La fecha final debe ser igual o posterior a la inicial')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Exportar CSV' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '' } });
    expect(mockUseAdmissions).toHaveBeenLastCalledWith(75, { from: '2026-01-01', to: '' }, false);
    expect(screen.getByText('Seleccione una fecha')).toBeInTheDocument();
    expect(screen.getByText('Selecciona un rango de fechas válido')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Periodo'), { target: { value: 'all' } });
    expect(screen.queryByLabelText('Desde')).not.toBeInTheDocument();
    expect(mockUseAdmissions).toHaveBeenLastCalledWith(75, { from: '', to: '' }, true);
    fireEvent.change(screen.getByLabelText('Periodo'), { target: { value: 'today' } });
    expect(mockUseAdmissions).toHaveBeenLastCalledWith(75, { from: today, to: today }, true);
  });

  it('filters the complete dataset by type and UPSS, including rows after the first table page', () => {
    mockUseAdmissions.mockReturnValue({
      admissions: Array.from({ length: 26 }, (_, index) =>
        createAdmission({
          uuid: `visit-${index}`,
          patientName: `Synthetic ${index}`,
          service: index === 25 ? 'Emergencia' : 'Consulta externa',
          location: index === 25 ? 'Topico' : 'Admision Central',
        }),
      ),
      error: undefined,
      isLoading: false,
    });
    renderAdmissionHome();
    expect(screen.queryByRole('link', { name: 'Synthetic 25' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Página siguiente' }));
    expect(screen.getByRole('link', { name: 'Synthetic 25' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Tipo de visita'), { target: { value: 'Emergencia' } });
    expect(screen.getByRole('link', { name: 'Synthetic 25' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Synthetic 0' })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('UPSS'), { target: { value: 'Admision Central' } });
    expect(screen.queryByRole('link', { name: 'Synthetic 25' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Exportar CSV' })).toBeDisabled();
  });

  it('keeps the operational columns compact and exposes complementary data on expansion', () => {
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
          documentType: 'CE',
          documentNumber: 'CE-876543',
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
    for (const header of ['Fecha y hora', 'Paciente', 'Tipo de visita', 'UPSS', 'Estado de atención', 'Tiene SIS']) {
      expect(screen.getByRole('columnheader', { name: header })).toBeInTheDocument();
    }
    expect(screen.getAllByRole('columnheader')).toHaveLength(7);
    expect(screen.getByRole('link', { name: 'Ada Lovelace' })).toBeInTheDocument();
    expect(screen.getByText('HCE / código temporal: HC-99')).toBeInTheDocument();
    expect(screen.getByText('DNI: 12345678')).toBeInTheDocument();
    expect(screen.getByText('CE: CE-876543')).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'En curso' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Finalizada' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Sí' })).toBeInTheDocument();
    expect(screen.getByText(/9\/05\/26, 8:30/)).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Consulta externa' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Admision Central' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Topico' })).toBeInTheDocument();
    expect(screen.queryByText('Av. Peru 123, Lima, Lima')).not.toBeInTheDocument();

    const expand = screen.getByRole('button', { name: 'Ver detalles de Ada Lovelace' });
    expect(expand).toHaveAttribute('aria-expanded', 'false');
    const detailsId = expand.getAttribute('aria-controls');
    if (!detailsId) throw new Error('Missing details target');
    fireEvent.click(expand);
    expect(expand).toHaveAttribute('aria-expanded', 'true');
    const detailsElement = document.getElementById(detailsId);
    if (!detailsElement) throw new Error('Missing details row');
    const details = within(detailsElement);
    for (const label of [
      'Tipo doc.',
      'N° documento',
      'Estado identificación',
      'Responsable',
      'F. Nac.',
      'Edad',
      'Sexo',
      'Dirección',
      'Condición comunicación',
      'N° de fila del reporte',
    ]) {
      expect(details.getByText(label)).toBeInTheDocument();
    }
    for (const value of [
      'DNI',
      '12345678',
      'Confirmado',
      'Charles Babbage - Familiar',
      'Av. Peru 123, Lima, Lima',
      'F',
      'Puede comunicarse',
      '1',
    ]) {
      expect(details.getByText(value)).toBeInTheDocument();
    }
    fireEvent.click(screen.getByRole('button', { name: 'Ver detalles de Grace Hopper' }));
    expect(screen.getByText('CE')).toBeInTheDocument();
    expect(screen.getByText('CE-876543')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ocultar detalles de Ada Lovelace' }));
    expect(screen.queryByText('Av. Peru 123, Lima, Lima')).not.toBeInTheDocument();
    expect(getMetricValue('Atenciones registradas')).toHaveTextContent('2');
    expect(getMetricValue('En curso')).toHaveTextContent('1');
    expect(getMetricValue('Finalizadas')).toHaveTextContent('1');
    expect(getMetricValue('Tipos de visita reportados')).toHaveTextContent('2');
    expect(screen.queryByRole('link', { name: /fusionar historias duplicadas/i })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ada Lovelace' })).toHaveAttribute(
      'href',
      '/openmrs/spa/home/care-logbook/patient/patient-1',
    );
    expect(mockUseAdmissions).toHaveBeenCalledWith(
      75,
      expect.objectContaining({ from: expect.any(String), to: expect.any(String) }),
      true,
    );
  });

  it('preserves exact age with years, months, and days in visit details', () => {
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

    for (const button of screen.getAllByRole('button', { name: 'Ver detalles de Ada Lovelace' })) {
      fireEvent.click(button);
    }
    expect(screen.getByText('36 años 0 meses 0 días')).toBeInTheDocument();
    expect(screen.getByText('1 año 0 meses 2 días')).toBeInTheDocument();
    expect(screen.getByText('0 años 0 meses 21 días')).toBeInTheDocument();
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

    fireEvent.change(screen.getByRole('textbox', { name: /buscar atención/i }), { target: { value: '87654321' } });

    expect(screen.queryByRole('link', { name: 'Ada Lovelace' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Grace Hopper' })).toBeInTheDocument();
    expect(getMetricValue('Atenciones registradas')).toHaveTextContent('1');

    fireEvent.change(screen.getByLabelText(/filtrar por estado/i), { target: { value: 'Activa' } });

    expect(screen.queryByRole('link', { name: 'Grace Hopper' })).not.toBeInTheDocument();
    expect(screen.getByTestId('care-logbook-empty-state-illustration')).toBeInTheDocument();
    expect(screen.getByText(/no hay atenciones que coincidan/i)).toBeInTheDocument();
    expect(screen.getByText(/comprobar los filtros anteriores/i)).toBeInTheDocument();
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

    const searchInput = screen.getByRole('textbox', { name: /buscar atención/i });
    for (const query of ['TEMP-001', 'SIS-183299', 'María Quispe', 'Madre']) {
      fireEvent.change(searchInput, { target: { value: query } });

      expect(screen.getByRole('link', { name: 'Niño Prueba' })).toBeInTheDocument();
      expect(screen.queryByRole('link', { name: 'Grace Hopper' })).not.toBeInTheDocument();
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
          documentType: '',
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
    expect(csv).toContain('"Fecha y hora"');
    expect(csv).toContain('"HCE / código temporal"');
    expect(csv).toContain('"Tipo doc."');
    expect(csv).toContain('"N° documento"');
    expect(csv).toContain('"Estado identificación"');
    expect(csv).toContain('"Condición comunicación"');
    expect(csv).toContain('"Estado de atención"');
    expect(csv).toContain('"En curso"');
    expect(csv).toContain('"Sexo"');
    expect(csv).toContain('"Tipo de visita"');
    expect(csv).toContain('"UPSS"');
    expect(csv).toContain('"Admision Central"');
    expect(csv).toContain('"María Peña Ñaupari"');
    expect(csv).toContain('"Sí comunica"');
    expect(csv).toContain('"Jr. Unión 123, Huánuco"');
    expect(csv).toContain('"F"');
    expect(csv).toContain('"6 años 11 meses 8 días"');
    expect(csv).not.toContain('Ã');
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:atenciones');
  });

  it('uses the default report page size when config is empty', () => {
    mockUseConfig.mockReturnValue({});
    mockUseAdmissions.mockReturnValue({ admissions: [], error: undefined, isLoading: false });

    renderAdmissionHome();

    expect(mockUseAdmissions).toHaveBeenCalledWith(
      50,
      expect.objectContaining({ from: expect.any(String), to: expect.any(String) }),
      true,
    );
  });

  it('clears all filters including the selected historical period', () => {
    mockUseAdmissions.mockReturnValue({
      admissions: [createAdmission({})],
      error: undefined,
      isLoading: false,
    });
    renderAdmissionHome();
    expect(screen.getByRole('button', { name: 'Limpiar filtros' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Periodo'), { target: { value: 'range' } });
    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-01-01' } });
    fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '2026-01-31' } });
    fireEvent.change(screen.getByLabelText('Tipo de visita'), { target: { value: 'Consulta externa' } });
    fireEvent.change(screen.getByLabelText('UPSS'), { target: { value: 'Admision Central' } });
    fireEvent.change(screen.getByLabelText('Filtrar por estado'), { target: { value: 'Activa' } });
    fireEvent.change(screen.getByRole('textbox', { name: /buscar atención/i }), { target: { value: 'missing' } });
    expect(screen.getByText('No hay atenciones que coincidan')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Limpiar filtros' }));
    expect(screen.getByRole('link', { name: 'Ada Lovelace' })).toBeInTheDocument();
    expect(screen.getByLabelText('Tipo de visita')).toHaveValue('all');
    expect(screen.getByLabelText('UPSS')).toHaveValue('all');
    expect(screen.getByLabelText('Filtrar por estado')).toHaveValue('all');
    expect(screen.getByRole('textbox', { name: /buscar atención/i })).toHaveValue('');
    expect(screen.getByLabelText('Periodo')).toHaveValue('today');
    expect(screen.queryByLabelText('Desde')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Limpiar filtros' })).toBeDisabled();
  });

  it('keeps a patient without DNI or birthday identifiable and searchable by their responsible person', () => {
    mockUseAdmissions.mockReturnValue({
      admissions: [
        createAdmission({
          patientName: 'SYNTHETIC Sin identificar',
          medicalRecordNumber: 'TEMP-900',
          documentType: '',
          documentNumber: '',
          birthDate: '',
          identificationStatus: 'Pendiente',
        }),
      ],
      error: undefined,
      isLoading: false,
    });
    renderAdmissionHome();
    expect(screen.getByText('HCE / código temporal: TEMP-900')).toBeInTheDocument();
    expect(screen.queryByText(/^DNI:/)).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', { name: /buscar atención/i }), {
      target: { value: 'Charles Babbage' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Ver detalles de SYNTHETIC Sin identificar' }));
    expect(screen.getByText('Pendiente')).toBeInTheDocument();
    expect(screen.getByText('Charles Babbage - Familiar')).toBeInTheDocument();
    expect(screen.getAllByText('Sin registrar')).toHaveLength(4);
  });

  it('exports every filtered visit in a large history independently of pagination and collapsed details', async () => {
    const createObjectURL = vi.fn((_blob: Blob | MediaSource) => 'blob:history');
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectURL });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
    mockUseAdmissions.mockReturnValue({
      admissions: Array.from({ length: 2501 }, (_, index) =>
        createAdmission({
          uuid: `visit-${index}`,
          patientName: `SYNTHETIC ${index}`,
          status: index % 2 ? 'Finalizada' : 'Activa',
        }),
      ),
      error: undefined,
      isLoading: false,
    });
    renderAdmissionHome();
    expect(screen.getAllByRole('link')).toHaveLength(25);
    expect(screen.queryByText('Charles Babbage - Familiar')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Filtrar por estado'), { target: { value: 'Activa' } });
    fireEvent.click(screen.getByRole('button', { name: 'Página siguiente' }));
    fireEvent.click(screen.getByRole('button', { name: 'Exportar CSV' }));
    const csv = await (createObjectURL.mock.calls[0][0] as Blob).text();
    expect(csv.split('\r\n')).toHaveLength(1253); // Excel preamble, header and 1251 matching visits.
    expect(csv).toContain('"SYNTHETIC 0"');
    expect(csv).toContain('"SYNTHETIC 2500"');
    expect(csv).not.toContain('"SYNTHETIC 1"');
    expect(csv).toContain('"Charles Babbage - Familiar"');
    expect(csv).toContain('"Av. Peru 123, Lima, Lima"');
    expect(screen.getAllByRole('link')).toHaveLength(25);
  });

  it('shows only the table skeleton while care encounters are loading', () => {
    mockUseAdmissions.mockReturnValue({ admissions: [], error: undefined, isLoading: true });

    renderAdmissionHome();

    expect(screen.getByRole('progressbar', { name: /cargando atenciones/i })).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByTestId('care-logbook-empty-state')).not.toBeInTheDocument();
    expect(screen.queryByText(/no hay atenciones/i)).not.toBeInTheDocument();
    expect(getMetricValue('Atenciones registradas')).not.toHaveTextContent('0');
    expect(screen.getByRole('textbox', { name: /buscar atención/i })).toBeDisabled();
    expect(screen.getByLabelText(/filtrar por estado/i)).toBeDisabled();
    expect(screen.getByRole('button', { name: /exportar csv/i })).toBeDisabled();
  });

  it('shows the load error without also reporting an empty result', () => {
    mockUseAdmissions.mockReturnValue({ admissions: [], error: new Error('boom'), isLoading: false });

    renderAdmissionHome();

    expect(screen.getByText(/no se pudo cargar el libro de atenciones/i)).toBeInTheDocument();
    expect(screen.queryByTestId('care-logbook-empty-state')).not.toBeInTheDocument();
    expect(screen.queryByText(/no hay atenciones/i)).not.toBeInTheDocument();
    expect(getMetricValue('Atenciones registradas')).toHaveTextContent('—');
    expect(screen.getByRole('textbox', { name: /buscar atención/i })).toBeDisabled();
    expect(screen.getByLabelText(/filtrar por estado/i)).toBeDisabled();
    expect(screen.getByRole('button', { name: /exportar csv/i })).toBeDisabled();
  });

  it('shows an illustrated empty state when no care encounters exist', () => {
    mockUseAdmissions.mockReturnValue({ admissions: [], error: undefined, isLoading: false });

    renderAdmissionHome();

    expect(screen.getByRole('status')).toHaveAttribute('data-testid', 'care-logbook-empty-state');
    expect(screen.getByTestId('care-logbook-empty-state-illustration')).toBeInTheDocument();
    expect(screen.getByText(/no hay atenciones recientes para mostrar/i)).toBeInTheDocument();
    expect(screen.getByText(/las atenciones registradas aparecerán aquí/i)).toBeInTheDocument();
  });

  it('distinguishes an empty selected period from an empty search result', () => {
    mockUseAdmissions.mockReturnValue({ admissions: [], error: undefined, isLoading: false });
    renderAdmissionHome();

    fireEvent.change(screen.getByLabelText('Periodo'), { target: { value: 'all' } });
    expect(screen.getByText('No hay atenciones en el periodo seleccionado')).toBeInTheDocument();
    expect(screen.getByText('Prueba con otro rango de fechas o periodo')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', { name: /buscar atención/i }), { target: { value: 'SYNTHETIC' } });
    expect(screen.getByText('No hay atenciones que coincidan')).toBeInTheDocument();
  });

  it('renders data without a table skeleton or empty-state messaging', () => {
    mockUseAdmissions.mockReturnValue({
      admissions: [createAdmission({ patientName: 'Ada Lovelace' })],
      error: undefined,
      isLoading: false,
    });

    renderAdmissionHome();

    expect(screen.getByRole('table', { name: /atenciones registradas/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ada Lovelace' })).toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(screen.queryByTestId('care-logbook-empty-state')).not.toBeInTheDocument();
    expect(screen.queryByText(/no hay atenciones/i)).not.toBeInTheDocument();
  });
});
