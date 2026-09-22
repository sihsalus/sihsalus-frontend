import { usePatient, useSession, userHasAccess } from '@openmrs/esm-framework';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useSWRConfig } from 'swr';
import { mockFhirPatient, mockSessionDataResponse } from 'test-utils';
import { useStickerPdfPrinter } from '../hooks/useStickerPdfPrinter';
import PrintPatientIdentityModal from './print-patient-identity.modal';

vi.mock('../hooks/useStickerPdfPrinter', () => ({ useStickerPdfPrinter: vi.fn() }));
vi.mock('swr', async () => ({ ...(await vi.importActual('swr')), useSWRConfig: vi.fn() }));
const mockFetch = vi.fn();
const printPdf = vi.fn();
const mutate = vi.fn();
const revokeObjectURL = vi.fn();
const createObjectURL = vi.fn(() => 'blob:synthetic-patient-pdf');
const props = { patientUuid: mockFhirPatient.id, context: 'appointments' as const, closeModal: vi.fn() };
const pdfResponse = (status = 200, type = 'application/pdf', content = '%PDF-1.7 synthetic') =>
  ({
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ 'Content-Type': type }),
    blob: async () => new Blob([content], { type }),
  }) as Response;

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', mockFetch);
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectURL });
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeObjectURL });
  vi.mocked(useSession).mockReturnValue(mockSessionDataResponse.data);
  vi.mocked(userHasAccess).mockReturnValue(true);
  vi.mocked(usePatient).mockReturnValue({
    patient: mockFhirPatient,
    patientUuid: mockFhirPatient.id,
    isLoading: false,
    error: null,
  });
  vi.mocked(useSWRConfig).mockReturnValue({ mutate } as unknown as ReturnType<typeof useSWRConfig>);
  vi.mocked(useStickerPdfPrinter).mockReturnValue({ printPdf, isPrinting: false });
  printPdf.mockResolvedValue(undefined);
  mockFetch.mockResolvedValue(pdfResponse());
});

afterEach(() => vi.unstubAllGlobals());

it('prints the server PDF for the selected patient only after an explicit click and releases the blob', async () => {
  const user = userEvent.setup();
  render(<PrintPatientIdentityModal {...props} />);
  expect(mockFetch).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: 'Print' }));
  await waitFor(() => expect(printPdf).toHaveBeenCalledWith('blob:synthetic-patient-pdf'));
  expect(mockFetch).toHaveBeenCalledWith(
    expect.stringContaining(`patientIdSticker?patientUuid=${encodeURIComponent(props.patientUuid)}`),
    expect.objectContaining({
      credentials: 'same-origin',
      cache: 'no-store',
      redirect: 'error',
      signal: expect.any(AbortSignal),
    }),
  );
  expect(revokeObjectURL).toHaveBeenCalledWith('blob:synthetic-patient-pdf');
});

it.each([
  'appointments',
  'patient-chart-appointments',
] as const)('requires context access plus existing backend privileges for %s', (context) => {
  render(<PrintPatientIdentityModal {...props} context={context} />);
  expect(userHasAccess).toHaveBeenCalledWith(
    [
      context === 'appointments' ? 'app:home.citas' : 'app:hoja.clinica.citas',
      'App: Can generate a Patient Identity Sticker',
      'Get Patients',
    ],
    expect.anything(),
  );
});

it.each([
  'permission',
  'empty patient',
  'unknown context',
  'expired session',
])('does not read or print on direct invocation with %s', (condition) => {
  if (condition === 'permission') vi.mocked(userHasAccess).mockReturnValue(false);
  if (condition === 'expired session')
    vi.mocked(useSession).mockReturnValue({ ...mockSessionDataResponse.data, authenticated: false });
  render(
    <PrintPatientIdentityModal
      {...props}
      patientUuid={condition === 'empty patient' ? '' : props.patientUuid}
      context={condition === 'unknown context' ? ('invalid' as 'appointments') : props.context}
    />,
  );
  expect(screen.getByText(/Check your access/i)).toBeInTheDocument();
  expect(usePatient).not.toHaveBeenCalled();
  expect(mockFetch).not.toHaveBeenCalled();
  expect(printPdf).not.toHaveBeenCalled();
});

it.each(['loading', 'error', 'different patient'])('blocks printing with %s patient data', (condition) => {
  vi.mocked(usePatient).mockReturnValue({
    patient: condition === 'different patient' ? { ...mockFhirPatient, id: 'another-synthetic-patient' } : null,
    patientUuid: props.patientUuid,
    isLoading: condition === 'loading',
    error: condition === 'error' ? new Error('Private patient detail') : null,
  });
  render(<PrintPatientIdentityModal {...props} />);
  expect(screen.getByRole('button', { name: 'Print' })).toBeDisabled();
  expect(screen.queryByText(/Private patient detail/)).not.toBeInTheDocument();
  if (condition === 'error') {
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(mutate).toHaveBeenCalledWith(['patient', props.patientUuid]);
  }
  expect(mockFetch).not.toHaveBeenCalled();
});

it.each([
  [401, 'application/pdf', 'denied'],
  [403, 'application/pdf', 'denied'],
  [500, 'application/pdf', 'Private server detail'],
  [200, 'text/html', '<html>Login</html>'],
  [200, 'application/pdf', ''],
])('shows a safe retryable error for status %s, type %s and an unusable body', async (status, type, content) => {
  const user = userEvent.setup();
  mockFetch.mockResolvedValueOnce(pdfResponse(status, type, content));
  render(<PrintPatientIdentityModal {...props} />);
  await user.click(screen.getByRole('button', { name: 'Print' }));
  await screen.findByText(/identification document could not be printed/i);
  expect(printPdf).not.toHaveBeenCalled();
  expect(screen.queryByText(/Private server detail/)).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Print' })).toBeEnabled();
  await user.click(screen.getByRole('button', { name: 'Print' }));
  await waitFor(() => expect(printPdf).toHaveBeenCalledOnce());
});

it('blocks duplicate clicks before the network response completes', async () => {
  let resolve!: (response: Response) => void;
  mockFetch.mockReturnValue(new Promise<Response>((done) => (resolve = done)));
  render(<PrintPatientIdentityModal {...props} />);
  const button = screen.getByRole('button', { name: 'Print' });
  act(() => {
    fireEvent.click(button);
    fireEvent.click(button);
  });
  expect(mockFetch).toHaveBeenCalledOnce();
  expect(button).toBeDisabled();
  await act(async () => resolve(pdfResponse()));
  expect(printPdf).toHaveBeenCalledOnce();
});

it.each([
  'unmount',
  'patient',
  'account',
  'permission',
])('cancels a pending document on %s change and ignores its late response', async (change) => {
  let resolve!: (response: Response) => void;
  mockFetch.mockReturnValue(new Promise<Response>((done) => (resolve = done)));
  const { unmount, rerender } = render(<PrintPatientIdentityModal {...props} />);
  fireEvent.click(screen.getByRole('button', { name: 'Print' }));
  const signal = mockFetch.mock.calls[0][1].signal as AbortSignal;
  if (change === 'unmount') unmount();
  else {
    if (change === 'account')
      vi.mocked(useSession).mockReturnValue({
        ...mockSessionDataResponse.data,
        user: { ...mockSessionDataResponse.data.user, uuid: 'another-synthetic-user' },
      });
    if (change === 'permission') vi.mocked(userHasAccess).mockReturnValue(false);
    rerender(
      <PrintPatientIdentityModal
        {...props}
        patientUuid={change === 'patient' ? 'another-synthetic-patient' : props.patientUuid}
      />,
    );
  }
  expect(signal.aborted).toBe(true);
  await act(async () => resolve(pdfResponse()));
  expect(printPdf).not.toHaveBeenCalled();
  expect(createObjectURL).not.toHaveBeenCalled();
});

it('reports printer failure without backend or browser details and releases the document', async () => {
  const user = userEvent.setup();
  printPdf.mockRejectedValueOnce(new Error('Private browser detail'));
  render(<PrintPatientIdentityModal {...props} />);
  await user.click(screen.getByRole('button', { name: 'Print' }));
  await screen.findByText(/identification document could not be printed/i);
  expect(screen.queryByText(/Private browser detail/)).not.toBeInTheDocument();
  expect(revokeObjectURL).toHaveBeenCalledOnce();
});

it('times out a stalled PDF request and allows retry', async () => {
  vi.useFakeTimers();
  mockFetch.mockImplementationOnce(
    (_url, init: RequestInit) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
      }),
  );
  render(<PrintPatientIdentityModal {...props} />);
  fireEvent.click(screen.getByRole('button', { name: 'Print' }));
  await act(async () => {
    await vi.advanceTimersByTimeAsync(30000);
  });
  expect(screen.getByText(/identification document could not be printed/i)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Print' })).toBeEnabled();
  expect(printPdf).not.toHaveBeenCalled();
  vi.useRealTimers();
});

it('releases the prepared PDF when the modal closes while printing', async () => {
  let finish!: () => void;
  printPdf.mockReturnValueOnce(new Promise<void>((resolve) => (finish = resolve)));
  const { unmount } = render(<PrintPatientIdentityModal {...props} />);
  fireEvent.click(screen.getByRole('button', { name: 'Print' }));
  await waitFor(() => expect(printPdf).toHaveBeenCalledOnce());
  unmount();
  expect(revokeObjectURL).toHaveBeenCalledWith('blob:synthetic-patient-pdf');
  await act(async () => finish());
  expect(revokeObjectURL).toHaveBeenCalledOnce();
});
