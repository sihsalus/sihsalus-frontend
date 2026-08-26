import { showSnackbar, useConfig, usePatient, useSession } from '@openmrs/esm-framework';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useAmbulatoryVisitGuard } from '../hooks';
import { fetchNextScheduledAppointment, isUpcomingScheduledAppointment } from './outpatient-next-appointment.resource';
import { printPdfBytes } from './outpatient-pdf-print';
import {
  buildOutpatientVisitSummary,
  fetchOutpatientVisitSummarySource,
  getLinkedAppointmentUuids,
} from './outpatient-visit-summary.resource';
import OutpatientVisitSummaryDownload from './outpatient-visit-summary-download.component';
import {
  createOutpatientPatientInstructionsFileName,
  createOutpatientPatientInstructionsPdf,
  createOutpatientVisitSummaryFileName,
  createOutpatientVisitSummaryPdf,
  downloadOutpatientVisitSummaryPdf,
  hasOutpatientPatientInstructions,
} from './outpatient-visit-summary-pdf';

vi.mock('../hooks', () => ({ useAmbulatoryVisitGuard: vi.fn() }));
vi.mock('./outpatient-next-appointment.resource', () => ({
  fetchNextScheduledAppointment: vi.fn(),
  isUpcomingScheduledAppointment: vi.fn((appointment) => Boolean(appointment)),
}));
vi.mock('./outpatient-pdf-print', () => ({
  printPdfBytes: vi.fn(async () => 'print-requested'),
}));
vi.mock('./outpatient-visit-summary-pdf', () => ({
  createOutpatientPatientInstructionsFileName: vi.fn(() => 'patient-instructions.pdf'),
  createOutpatientPatientInstructionsPdf: vi.fn(async () => new Uint8Array([4, 5, 6])),
  createOutpatientVisitSummaryFileName: vi.fn(() => 'visit-report.pdf'),
  createOutpatientVisitSummaryPdf: vi.fn(async () => new Uint8Array([1, 2, 3])),
  downloadOutpatientVisitSummaryPdf: vi.fn(),
  hasOutpatientPatientInstructions: vi.fn(() => true),
}));
vi.mock('./outpatient-visit-summary.resource', () => ({
  buildOutpatientVisitSummary: vi.fn(() => ({
    visitUuid: 'visit-uuid',
    visitStart: '2026-08-23T14:00:00.000-05:00',
    hasClinicalContent: true,
  })),
  fetchOutpatientVisitSummarySource: vi.fn(async () => ({
    uuid: 'visit-uuid',
  })),
  getLinkedAppointmentUuids: vi.fn(() => ['current-appointment-uuid']),
}));

const mockUseConfig = vi.mocked(useConfig);
const mockUsePatient = vi.mocked(usePatient);
const mockUseSession = vi.mocked(useSession);
const mockUseAmbulatoryVisitGuard = vi.mocked(useAmbulatoryVisitGuard);
const mockFetchNextScheduledAppointment = vi.mocked(fetchNextScheduledAppointment);
const mockIsUpcomingScheduledAppointment = vi.mocked(isUpcomingScheduledAppointment);
const mockBuildSummary = vi.mocked(buildOutpatientVisitSummary);
const mockFetchSource = vi.mocked(fetchOutpatientVisitSummarySource);
const mockGetLinkedAppointmentUuids = vi.mocked(getLinkedAppointmentUuids);
const mockCreateVisitPdf = vi.mocked(createOutpatientVisitSummaryPdf);
const mockDownloadPdf = vi.mocked(downloadOutpatientVisitSummaryPdf);
const mockCreateVisitFileName = vi.mocked(createOutpatientVisitSummaryFileName);
const mockCreateInstructionsPdf = vi.mocked(createOutpatientPatientInstructionsPdf);
const mockCreateInstructionsFileName = vi.mocked(createOutpatientPatientInstructionsFileName);
const mockHasInstructions = vi.mocked(hasOutpatientPatientInstructions);
const mockPrintPdf = vi.mocked(printPdfBytes);
const mockShowSnackbar = vi.mocked(showSnackbar);

const patient = {
  resourceType: 'Patient',
  id: 'patient-uuid',
  name: [{ given: ['Paciente'], family: 'Sintético' }],
  identifier: [{ value: '00000000', type: { text: 'DNI' } }],
  birthDate: '1990-01-01',
  gender: 'female',
} as fhir.Patient;

const scheduledAppointment = {
  uuid: 'appointment-uuid',
  startDateTime: '2026-08-30T14:00:00.000Z',
  service: 'Consulta sintética',
  location: 'Consultorio sintético',
  provider: 'Profesional sintético',
};

function createDeferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
}

describe('OutpatientVisitSummaryDownload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseConfig.mockReturnValue({
      appointmentVisitAttributeTypeUuid: 'appointment-link-type-uuid',
      visitTypes: { ambulatory: 'ambulatory-type' },
      outpatientDocumentFacilityAddress: 'Distrito de prueba, provincia de prueba, Loreto',
      outpatientDocumentFacilityPhone: '900 000 000',
      referralOriginRenaesCode: '00000000',
      concepts: {},
    });
    mockUsePatient.mockReturnValue({ patient, isLoading: false, error: null });
    mockUseSession.mockReturnValue({
      sessionLocation: { display: 'IPRESS Sintética' },
    });
    mockUseAmbulatoryVisitGuard.mockReturnValue({
      verifiedAmbulatoryVisitUuid: 'visit-uuid',
      requireAmbulatoryVisit: () =>
        ({
          uuid: 'visit-uuid',
          startDatetime: '2026-08-23T14:00:00.000-05:00',
          visitType: { uuid: 'ambulatory-type' },
        }) as ReturnType<ReturnType<typeof useAmbulatoryVisitGuard>['requireAmbulatoryVisit']>,
    });
    mockBuildSummary.mockReturnValue({
      visitUuid: 'visit-uuid',
      visitStart: '2026-08-23T14:00:00.000-05:00',
      hasClinicalContent: true,
    } as ReturnType<typeof buildOutpatientVisitSummary>);
    mockFetchSource.mockResolvedValue({
      uuid: 'visit-uuid',
    } as Awaited<ReturnType<typeof fetchOutpatientVisitSummarySource>>);
    mockCreateVisitPdf.mockResolvedValue(new Uint8Array([1, 2, 3]));
    mockCreateVisitFileName.mockReturnValue('visit-report.pdf');
    mockCreateInstructionsPdf.mockResolvedValue(new Uint8Array([4, 5, 6]));
    mockCreateInstructionsFileName.mockReturnValue('patient-instructions.pdf');
    mockHasInstructions.mockReturnValue(true);
    mockPrintPdf.mockResolvedValue('print-requested');
    mockIsUpcomingScheduledAppointment.mockImplementation((appointment) => Boolean(appointment));
    mockFetchNextScheduledAppointment.mockResolvedValue(scheduledAppointment);
  });

  it('downloads one locally generated full PDF for the verified active visit', async () => {
    const user = userEvent.setup();
    render(<OutpatientVisitSummaryDownload patientUuid="patient-uuid" />);

    await user.click(
      screen.getByRole('button', {
        name: 'Descargar resumen de esta atención',
      }),
    );
    await waitFor(() => expect(mockDownloadPdf).toHaveBeenCalledWith(new Uint8Array([1, 2, 3]), 'visit-report.pdf'));
    expect(mockFetchSource).toHaveBeenCalledWith('visit-uuid');
    expect(mockBuildSummary).toHaveBeenCalledWith(
      expect.objectContaining({
        expectedPatientUuid: 'patient-uuid',
        expectedVisitUuid: 'visit-uuid',
        expectedVisitTypeUuid: 'ambulatory-type',
        facilityName: 'IPRESS Sintética',
        facilityAddress: 'Distrito de prueba, provincia de prueba, Loreto',
        facilityPhone: '900 000 000',
        facilityIpressCode: '00000000',
      }),
    );
    expect(mockCreateVisitFileName).toHaveBeenCalledWith('visit-uuid', '2026-08-23T14:00:00.000-05:00');
    expect(mockShowSnackbar).toHaveBeenCalledWith(expect.objectContaining({ kind: 'success' }));
  });

  it('generates the concise PDF and opens the browser print flow', async () => {
    const user = userEvent.setup();
    render(<OutpatientVisitSummaryDownload patientUuid="patient-uuid" />);

    await user.click(screen.getByRole('button', { name: 'Imprimir indicaciones' }));

    await waitFor(() =>
      expect(mockPrintPdf).toHaveBeenCalledWith(
        new Uint8Array([4, 5, 6]),
        'patient-instructions.pdf',
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      ),
    );
    expect(mockHasInstructions).toHaveBeenCalledWith(
      expect.objectContaining({ visitUuid: 'visit-uuid' }),
      scheduledAppointment,
    );
    expect(mockGetLinkedAppointmentUuids).toHaveBeenCalledWith(
      expect.objectContaining({ uuid: 'visit-uuid' }),
      'appointment-link-type-uuid',
    );
    expect(mockFetchNextScheduledAppointment).toHaveBeenCalledWith('patient-uuid', {
      excludedAppointmentUuids: ['current-appointment-uuid'],
    });
    expect(mockCreateInstructionsPdf).toHaveBeenCalledWith(
      expect.objectContaining({ visitUuid: 'visit-uuid' }),
      expect.objectContaining({
        indicatedFollowUpDate: 'Fecha de control indicada',
        medications: 'Medicamentos indicados',
        signatureAndStamp: 'Firma y sello del profesional responsable',
        therapeuticIndications: 'Indicaciones terapéuticas',
      }),
      expect.any(String),
      scheduledAppointment,
    );
    expect(mockCreateInstructionsFileName).toHaveBeenCalledWith('visit-uuid', '2026-08-23T14:00:00.000-05:00');
    expect(mockDownloadPdf).not.toHaveBeenCalled();
    expect(mockShowSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'success',
        title: 'Indicaciones listas',
      }),
    );
  });

  it('does not generate an empty patient instructions document', async () => {
    const user = userEvent.setup();
    mockFetchNextScheduledAppointment.mockResolvedValue(null);
    mockHasInstructions.mockReturnValue(false);
    render(<OutpatientVisitSummaryDownload patientUuid="patient-uuid" />);

    await user.click(screen.getByRole('button', { name: 'Imprimir indicaciones' }));

    await waitFor(() => expect(mockShowSnackbar).toHaveBeenCalledWith(expect.objectContaining({ kind: 'error' })));
    expect(mockCreateInstructionsPdf).not.toHaveBeenCalled();
    expect(mockPrintPdf).not.toHaveBeenCalled();
  });

  it('prints the remaining instructions but warns when the appointment calendar cannot be verified', async () => {
    const user = userEvent.setup();
    mockFetchNextScheduledAppointment.mockRejectedValueOnce({
      response: { status: 403 },
    });
    render(<OutpatientVisitSummaryDownload patientUuid="patient-uuid" />);

    await user.click(screen.getByRole('button', { name: 'Imprimir indicaciones' }));

    await waitFor(() => expect(mockPrintPdf).toHaveBeenCalledOnce());
    expect(mockCreateInstructionsPdf).toHaveBeenCalledWith(
      expect.objectContaining({ visitUuid: 'visit-uuid' }),
      expect.any(Object),
      expect.any(String),
      null,
    );
    expect(mockShowSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'warning',
        title: 'No se pudo verificar la cita programada',
      }),
    );
  });

  it('does not fetch clinical data when no verified visit is available', async () => {
    const user = userEvent.setup();
    mockUseAmbulatoryVisitGuard.mockReturnValue({
      verifiedAmbulatoryVisitUuid: null,
      requireAmbulatoryVisit: () => null,
    });
    render(<OutpatientVisitSummaryDownload patientUuid="patient-uuid" />);

    await user.click(screen.getByRole('button', { name: 'Imprimir indicaciones' }));

    expect(mockFetchSource).not.toHaveBeenCalled();
    expect(mockCreateInstructionsPdf).not.toHaveBeenCalled();
  });

  it('serializes generation across the print and download actions', async () => {
    let resolvePdf: (bytes: Uint8Array) => void = () => undefined;
    mockCreateVisitPdf.mockReturnValueOnce(new Promise((resolve) => (resolvePdf = resolve)));
    render(<OutpatientVisitSummaryDownload patientUuid="patient-uuid" />);

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Descargar resumen de esta atención',
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Imprimir indicaciones' }));

    expect(
      screen.getByRole('group', {
        name: 'Documentos de la atención ambulatoria',
      }),
    ).toHaveAttribute('aria-busy', 'true');
    expect(mockFetchSource).toHaveBeenCalledOnce();
    expect(mockCreateInstructionsPdf).not.toHaveBeenCalled();
    resolvePdf(new Uint8Array([1, 2, 3]));
    await waitFor(() => expect(mockDownloadPdf).toHaveBeenCalledOnce());
    expect(
      screen.getByRole('group', {
        name: 'Documentos de la atención ambulatoria',
      }),
    ).toHaveAttribute('aria-busy', 'false');
  });

  it('does not print a stale patient PDF after navigating to another patient', async () => {
    const user = userEvent.setup();
    const appointmentRequest = createDeferred<typeof scheduledAppointment | null>();
    mockFetchNextScheduledAppointment.mockReturnValueOnce(appointmentRequest.promise);
    const { rerender } = render(<OutpatientVisitSummaryDownload patientUuid="patient-uuid" />);

    await user.click(screen.getByRole('button', { name: 'Imprimir indicaciones' }));
    await waitFor(() => expect(mockFetchNextScheduledAppointment).toHaveBeenCalledOnce());

    rerender(<OutpatientVisitSummaryDownload patientUuid="other-patient-uuid" />);
    await act(async () => {
      appointmentRequest.resolve(scheduledAppointment);
      await appointmentRequest.promise;
    });

    expect(mockCreateInstructionsPdf).not.toHaveBeenCalled();
    expect(mockPrintPdf).not.toHaveBeenCalled();
    expect(mockDownloadPdf).not.toHaveBeenCalled();
    expect(mockShowSnackbar).not.toHaveBeenCalledWith(expect.objectContaining({ kind: 'success' }));
  });

  it('aborts the pending print viewer after navigating to another patient', async () => {
    const user = userEvent.setup();
    let printSignal: AbortSignal | undefined;
    mockPrintPdf.mockImplementationOnce((_bytes, _fileName, options) => {
      printSignal = options?.signal;
      return new Promise((resolve) => {
        options?.signal?.addEventListener('abort', () => resolve('cancelled'), { once: true });
      });
    });
    const { rerender } = render(<OutpatientVisitSummaryDownload patientUuid="patient-uuid" />);

    await user.click(screen.getByRole('button', { name: 'Imprimir indicaciones' }));
    await waitFor(() => expect(mockPrintPdf).toHaveBeenCalledOnce());

    rerender(<OutpatientVisitSummaryDownload patientUuid="other-patient-uuid" />);

    await waitFor(() => expect(printSignal?.aborted).toBe(true));
    expect(mockDownloadPdf).not.toHaveBeenCalled();
    expect(mockShowSnackbar).not.toHaveBeenCalledWith(expect.objectContaining({ kind: 'success' }));
  });

  it('aborts the pending print viewer when the document actions unmount', async () => {
    const user = userEvent.setup();
    let printSignal: AbortSignal | undefined;
    mockPrintPdf.mockImplementationOnce((_bytes, _fileName, options) => {
      printSignal = options?.signal;
      return new Promise((resolve) => {
        options?.signal?.addEventListener('abort', () => resolve('cancelled'), { once: true });
      });
    });
    const { unmount } = render(<OutpatientVisitSummaryDownload patientUuid="patient-uuid" />);

    await user.click(screen.getByRole('button', { name: 'Imprimir indicaciones' }));
    await waitFor(() => expect(mockPrintPdf).toHaveBeenCalledOnce());

    unmount();

    await waitFor(() => expect(printSignal?.aborted).toBe(true));
    expect(mockDownloadPdf).not.toHaveBeenCalled();
    expect(mockShowSnackbar).not.toHaveBeenCalledWith(expect.objectContaining({ kind: 'success' }));
  });

  it('aborts the print resource after print was requested when the document actions unmount', async () => {
    const user = userEvent.setup();
    let printSignal: AbortSignal | undefined;
    mockPrintPdf.mockImplementationOnce(async (_bytes, _fileName, options) => {
      printSignal = options?.signal;
      return 'print-requested';
    });
    const { unmount } = render(<OutpatientVisitSummaryDownload patientUuid="patient-uuid" />);

    await user.click(screen.getByRole('button', { name: 'Imprimir indicaciones' }));
    await waitFor(() => expect(mockShowSnackbar).toHaveBeenCalledWith(expect.objectContaining({ kind: 'success' })));
    expect(printSignal?.aborted).toBe(false);

    unmount();

    expect(printSignal?.aborted).toBe(true);
  });

  it('regenerates without an appointment that expires before printing', async () => {
    const user = userEvent.setup();
    const staleAppointmentBytes = new Uint8Array([4, 5, 6]);
    const regeneratedBytes = new Uint8Array([7, 8, 9]);
    mockIsUpcomingScheduledAppointment.mockReturnValueOnce(true).mockReturnValueOnce(false);
    mockCreateInstructionsPdf.mockResolvedValueOnce(staleAppointmentBytes).mockResolvedValueOnce(regeneratedBytes);
    render(<OutpatientVisitSummaryDownload patientUuid="patient-uuid" />);

    await user.click(screen.getByRole('button', { name: 'Imprimir indicaciones' }));

    await waitFor(() => expect(mockPrintPdf).toHaveBeenCalledOnce());
    expect(mockCreateInstructionsPdf).toHaveBeenNthCalledWith(
      1,
      expect.any(Object),
      expect.any(Object),
      expect.any(String),
      scheduledAppointment,
    );
    expect(mockCreateInstructionsPdf).toHaveBeenNthCalledWith(
      2,
      expect.any(Object),
      expect.any(Object),
      expect.any(String),
      null,
    );
    expect(mockPrintPdf).toHaveBeenCalledOnce();
    expect(mockPrintPdf.mock.calls[0][0]).toEqual(regeneratedBytes);
    expect(mockPrintPdf.mock.calls[0][0]).not.toEqual(staleAppointmentBytes);
  });

  it('regenerates once without an appointment that expires while the print viewer loads', async () => {
    const user = userEvent.setup();
    mockIsUpcomingScheduledAppointment.mockReturnValueOnce(true).mockReturnValueOnce(true).mockReturnValueOnce(false);
    mockPrintPdf.mockImplementationOnce(async (_bytes, _fileName, options) =>
      options?.isContentCurrent?.() ? 'print-requested' : 'content-stale',
    );
    render(<OutpatientVisitSummaryDownload patientUuid="patient-uuid" />);

    await user.click(screen.getByRole('button', { name: 'Imprimir indicaciones' }));

    await waitFor(() => expect(mockPrintPdf).toHaveBeenCalledTimes(2));
    expect(mockCreateInstructionsPdf).toHaveBeenNthCalledWith(
      1,
      expect.any(Object),
      expect.any(Object),
      expect.any(String),
      scheduledAppointment,
    );
    expect(mockCreateInstructionsPdf).toHaveBeenNthCalledWith(
      2,
      expect.any(Object),
      expect.any(Object),
      expect.any(String),
      null,
    );
    expect(mockPrintPdf).toHaveBeenNthCalledWith(
      1,
      expect.any(Uint8Array),
      'patient-instructions.pdf',
      expect.objectContaining({ isContentCurrent: expect.any(Function) }),
    );
    expect(mockPrintPdf).toHaveBeenNthCalledWith(
      2,
      expect.any(Uint8Array),
      'patient-instructions.pdf',
      expect.not.objectContaining({ isContentCurrent: expect.any(Function) }),
    );
  });

  it('allows the new patient operation without letting the stale operation interfere', async () => {
    const user = userEvent.setup();
    const staleAppointmentRequest = createDeferred<typeof scheduledAppointment | null>();
    mockFetchNextScheduledAppointment.mockReturnValueOnce(staleAppointmentRequest.promise);
    const { rerender } = render(<OutpatientVisitSummaryDownload patientUuid="patient-uuid" />);

    await user.click(screen.getByRole('button', { name: 'Imprimir indicaciones' }));
    await waitFor(() => expect(mockFetchNextScheduledAppointment).toHaveBeenCalledOnce());

    mockUsePatient.mockReturnValue({
      patient: { ...patient, id: 'other-patient-uuid' },
      isLoading: false,
      error: null,
    });
    mockUseAmbulatoryVisitGuard.mockReturnValue({
      verifiedAmbulatoryVisitUuid: 'replacement-visit-uuid',
      requireAmbulatoryVisit: () =>
        ({
          uuid: 'replacement-visit-uuid',
          startDatetime: '2026-08-25T15:00:00.000-05:00',
          visitType: { uuid: 'ambulatory-type' },
        }) as ReturnType<ReturnType<typeof useAmbulatoryVisitGuard>['requireAmbulatoryVisit']>,
    });
    rerender(<OutpatientVisitSummaryDownload patientUuid="other-patient-uuid" />);
    await user.click(screen.getByRole('button', { name: 'Imprimir indicaciones' }));
    await waitFor(() => expect(mockPrintPdf).toHaveBeenCalledOnce());

    await act(async () => {
      staleAppointmentRequest.resolve(scheduledAppointment);
      await staleAppointmentRequest.promise;
    });

    expect(mockCreateInstructionsPdf).toHaveBeenCalledOnce();
    expect(mockPrintPdf).toHaveBeenCalledOnce();
    expect(mockDownloadPdf).not.toHaveBeenCalled();
  });

  it('does not print a stale PDF after the active outpatient visit changes', async () => {
    const user = userEvent.setup();
    const appointmentRequest = createDeferred<typeof scheduledAppointment | null>();
    mockFetchNextScheduledAppointment.mockReturnValueOnce(appointmentRequest.promise);
    const { rerender } = render(<OutpatientVisitSummaryDownload patientUuid="patient-uuid" />);

    await user.click(screen.getByRole('button', { name: 'Imprimir indicaciones' }));
    await waitFor(() => expect(mockFetchNextScheduledAppointment).toHaveBeenCalledOnce());

    mockUseAmbulatoryVisitGuard.mockReturnValue({
      verifiedAmbulatoryVisitUuid: 'replacement-visit-uuid',
      requireAmbulatoryVisit: () =>
        ({
          uuid: 'replacement-visit-uuid',
          startDatetime: '2026-08-25T15:00:00.000-05:00',
          visitType: { uuid: 'ambulatory-type' },
        }) as ReturnType<ReturnType<typeof useAmbulatoryVisitGuard>['requireAmbulatoryVisit']>,
    });
    rerender(<OutpatientVisitSummaryDownload patientUuid="patient-uuid" />);
    await act(async () => {
      appointmentRequest.resolve(scheduledAppointment);
      await appointmentRequest.promise;
    });

    expect(mockCreateInstructionsPdf).not.toHaveBeenCalled();
    expect(mockPrintPdf).not.toHaveBeenCalled();
    expect(mockDownloadPdf).not.toHaveBeenCalled();
    expect(mockShowSnackbar).not.toHaveBeenCalledWith(expect.objectContaining({ kind: 'success' }));
  });

  it('does not create or expose a PDF after the document actions unmount', async () => {
    const user = userEvent.setup();
    const summaryRequest = createDeferred<Awaited<ReturnType<typeof fetchOutpatientVisitSummarySource>>>();
    mockFetchSource.mockReturnValueOnce(summaryRequest.promise);
    const { unmount } = render(<OutpatientVisitSummaryDownload patientUuid="patient-uuid" />);

    await user.click(screen.getByRole('button', { name: 'Imprimir indicaciones' }));
    await waitFor(() => expect(mockFetchSource).toHaveBeenCalledOnce());

    unmount();
    await act(async () => {
      summaryRequest.resolve({ uuid: 'visit-uuid' });
      await summaryRequest.promise;
    });

    expect(mockFetchNextScheduledAppointment).not.toHaveBeenCalled();
    expect(mockCreateInstructionsPdf).not.toHaveBeenCalled();
    expect(mockPrintPdf).not.toHaveBeenCalled();
    expect(mockDownloadPdf).not.toHaveBeenCalled();
    expect(mockShowSnackbar).not.toHaveBeenCalledWith(expect.objectContaining({ kind: 'success' }));
  });

  it('fails closed when a clinical character cannot be represented safely', async () => {
    const user = userEvent.setup();
    const unsupportedCharacterError = new Error('synthetic unsupported character');
    unsupportedCharacterError.name = 'OutpatientPdfUnsupportedCharacterError';
    mockCreateInstructionsPdf.mockRejectedValueOnce(unsupportedCharacterError);
    render(<OutpatientVisitSummaryDownload patientUuid="patient-uuid" />);

    await user.click(screen.getByRole('button', { name: 'Imprimir indicaciones' }));

    await waitFor(() =>
      expect(mockShowSnackbar).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: 'error',
          subtitle:
            'El documento contiene caracteres que no se pueden representar con seguridad. Revise el texto registrado o contacte a soporte.',
        }),
      ),
    );
    expect(mockPrintPdf).not.toHaveBeenCalled();
    expect(screen.queryByText(/synthetic unsupported character/i)).not.toBeInTheDocument();
  });

  it('shows a safe toast without exposing technical details', async () => {
    const user = userEvent.setup();
    mockFetchSource.mockRejectedValueOnce(new Error('synthetic backend details'));
    render(<OutpatientVisitSummaryDownload patientUuid="patient-uuid" />);

    await user.click(screen.getByRole('button', { name: 'Imprimir indicaciones' }));

    await waitFor(() => expect(mockShowSnackbar).toHaveBeenCalledWith(expect.objectContaining({ kind: 'error' })));
    expect(screen.queryByText(/synthetic backend details/i)).not.toBeInTheDocument();
  });
});
