import { showSnackbar, useConfig, usePatient, useSession } from '@openmrs/esm-framework';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useAmbulatoryVisitGuard } from '../hooks';
import { buildOutpatientVisitSummary, fetchOutpatientVisitSummarySource } from './outpatient-visit-summary.resource';
import OutpatientVisitSummaryDownload from './outpatient-visit-summary-download.component';
import {
  createOutpatientVisitSummaryFileName,
  createOutpatientVisitSummaryPdf,
  downloadOutpatientVisitSummaryPdf,
} from './outpatient-visit-summary-pdf';

vi.mock('../hooks', () => ({ useAmbulatoryVisitGuard: vi.fn() }));
vi.mock('./outpatient-visit-summary-pdf', () => ({
  createOutpatientVisitSummaryFileName: vi.fn(() => 'visit-report.pdf'),
  createOutpatientVisitSummaryPdf: vi.fn(async () => new Uint8Array([1, 2, 3])),
  downloadOutpatientVisitSummaryPdf: vi.fn(),
}));
vi.mock('./outpatient-visit-summary.resource', () => ({
  buildOutpatientVisitSummary: vi.fn(() => ({
    visitUuid: 'visit-uuid',
    visitStart: '2026-08-23T14:00:00.000-05:00',
    hasClinicalContent: true,
  })),
  fetchOutpatientVisitSummarySource: vi.fn(async () => ({ uuid: 'visit-uuid' })),
}));

const mockUseConfig = vi.mocked(useConfig);
const mockUsePatient = vi.mocked(usePatient);
const mockUseSession = vi.mocked(useSession);
const mockUseAmbulatoryVisitGuard = vi.mocked(useAmbulatoryVisitGuard);
const mockBuildSummary = vi.mocked(buildOutpatientVisitSummary);
const mockFetchSource = vi.mocked(fetchOutpatientVisitSummarySource);
const mockCreatePdf = vi.mocked(createOutpatientVisitSummaryPdf);
const mockDownloadPdf = vi.mocked(downloadOutpatientVisitSummaryPdf);
const mockCreateFileName = vi.mocked(createOutpatientVisitSummaryFileName);
const mockShowSnackbar = vi.mocked(showSnackbar);

const patient = {
  resourceType: 'Patient',
  id: 'patient-uuid',
  name: [{ given: ['Paciente'], family: 'Sintético' }],
  identifier: [{ value: '00000000', type: { text: 'DNI' } }],
  birthDate: '1990-01-01',
  gender: 'female',
} as fhir.Patient;

describe('OutpatientVisitSummaryDownload', () => {
  beforeEach(() => {
    mockUseConfig.mockReturnValue({
      visitTypes: { ambulatory: 'ambulatory-type' },
      concepts: {},
    });
    mockUsePatient.mockReturnValue({ patient, isLoading: false, error: null });
    mockUseSession.mockReturnValue({ sessionLocation: { display: 'IPRESS Sintética' } });
    mockUseAmbulatoryVisitGuard.mockReturnValue({
      requireAmbulatoryVisit: () =>
        ({
          uuid: 'visit-uuid',
          startDatetime: '2026-08-23T14:00:00.000-05:00',
          visitType: { uuid: 'ambulatory-type' },
        }) as ReturnType<ReturnType<typeof useAmbulatoryVisitGuard>['requireAmbulatoryVisit']>,
    });
  });

  it('downloads one locally generated PDF for the verified active visit', async () => {
    const user = userEvent.setup();
    render(<OutpatientVisitSummaryDownload patientUuid="patient-uuid" />);

    await user.click(screen.getByRole('button', { name: 'Descargar informe de esta visita' }));

    await waitFor(() => expect(mockDownloadPdf).toHaveBeenCalledWith(new Uint8Array([1, 2, 3]), 'visit-report.pdf'));
    expect(mockFetchSource).toHaveBeenCalledWith('visit-uuid');
    expect(mockBuildSummary).toHaveBeenCalledWith(
      expect.objectContaining({
        expectedPatientUuid: 'patient-uuid',
        expectedVisitUuid: 'visit-uuid',
        expectedVisitTypeUuid: 'ambulatory-type',
        facilityName: 'IPRESS Sintética',
      }),
    );
    expect(mockCreateFileName).toHaveBeenCalledWith('visit-uuid', '2026-08-23T14:00:00.000-05:00');
    expect(mockShowSnackbar).toHaveBeenCalledWith(expect.objectContaining({ kind: 'success' }));
  });

  it('does not fetch clinical data when no verified visit is available', async () => {
    const user = userEvent.setup();
    mockUseAmbulatoryVisitGuard.mockReturnValue({ requireAmbulatoryVisit: () => null });
    render(<OutpatientVisitSummaryDownload patientUuid="patient-uuid" />);

    await user.click(screen.getByRole('button', { name: 'Descargar informe de esta visita' }));

    expect(mockFetchSource).not.toHaveBeenCalled();
    expect(mockCreatePdf).not.toHaveBeenCalled();
  });

  it('serializes concurrent clicks before fetching or generating a report', async () => {
    const user = userEvent.setup();
    let resolvePdf: (bytes: Uint8Array) => void = () => undefined;
    mockCreatePdf.mockReturnValueOnce(new Promise((resolve) => (resolvePdf = resolve)));
    render(<OutpatientVisitSummaryDownload patientUuid="patient-uuid" />);
    const button = screen.getByRole('button', { name: 'Descargar informe de esta visita' });

    await Promise.all([user.click(button), user.click(button)]);
    expect(mockFetchSource).toHaveBeenCalledOnce();
    resolvePdf(new Uint8Array([1, 2, 3]));
    await waitFor(() => expect(mockDownloadPdf).toHaveBeenCalledOnce());
  });

  it('shows a safe toast without exposing technical details', async () => {
    const user = userEvent.setup();
    mockFetchSource.mockRejectedValueOnce(new Error('synthetic backend details'));
    render(<OutpatientVisitSummaryDownload patientUuid="patient-uuid" />);

    await user.click(screen.getByRole('button', { name: 'Descargar informe de esta visita' }));

    await waitFor(() => expect(mockShowSnackbar).toHaveBeenCalledWith(expect.objectContaining({ kind: 'error' })));
    expect(screen.queryByText(/synthetic backend details/i)).not.toBeInTheDocument();
  });
});
