import { showSnackbar, useConfig, usePatient } from '@openmrs/esm-framework';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReferralEntry } from '../hooks/useReferralCounterReferral';
import InstitutionalReferralDownload from './institutional-referral-download.component';
import { createInstitutionalReferralPdf, downloadInstitutionalReferralPdf } from './institutional-referral-pdf';
import { fetchOutpatientVisitSummarySource, type VisitSummarySource } from './outpatient-visit-summary.resource';
import { OutpatientPdfUnsupportedCharacterError } from './outpatient-visit-summary-pdf';

vi.mock('@openmrs/esm-patient-common-lib', async () => ({
  ...(await vi.importActual('@openmrs/esm-patient-common-lib')),
  fetchVisitInsurance: vi.fn(async () => ({ financiadorUuid: null, insuranceNumber: null })),
}));
vi.mock('./outpatient-visit-summary.resource', async () => ({
  ...(await vi.importActual('./outpatient-visit-summary.resource')),
  fetchOutpatientVisitSummarySource: vi.fn(),
}));
vi.mock('./institutional-referral-pdf', async () => ({
  ...(await vi.importActual('./institutional-referral-pdf')),
  createInstitutionalReferralPdf: vi.fn(async () => new Uint8Array([1, 2, 3])),
  downloadInstitutionalReferralPdf: vi.fn(),
}));

const entry: ReferralEntry = {
  uuid: 'referral',
  visitUuid: 'visit',
  encounterDatetime: '2030-01-02T10:00:00Z',
  provider: null,
  originService: 'Origen anterior',
  destinationService: 'Destino anterior',
  referralType: 'Urgencia',
  referralReason: 'Motivo sintético',
  referralDestination: 'Destino sintético',
  referralDestinationCode: null,
  referralDestinationSpecialty: 'Cirugía',
  referralDestinationSpecialtyOther: null,
  referralPatientCondition: null,
  referralTransportMode: null,
  counterReferralResponse: null,
  counterReferralCondition: null,
};
const source: VisitSummarySource = {
  uuid: 'visit',
  patient: { uuid: 'patient' },
  visitType: { uuid: 'ambulatory' },
  startDatetime: '2030-01-02T09:00:00Z',
  encounters: [
    {
      uuid: 'referral',
      encounterDatetime: entry.encounterDatetime,
      encounterType: { uuid: 'referral-type' },
      location: { uuid: 'origin', display: 'UPSS Emergencia' },
      obs: [
        {
          uuid: 'service-obs',
          concept: { uuid: 'service-question' },
          value: { uuid: 'destination-service', display: 'Consulta Externa' },
        },
      ],
    },
  ],
};

const config = {
  visitTypes: { ambulatory: 'ambulatory' },
  encounterTypes: { referralCounterReferral: 'referral-type', visitNote: 'visit-note' },
  formsList: { visitNoteFormUuid: 'note-form' },
  clinicianEncounterRoleUuid: 'clinician',
  professionalRegistrationProviderAttributeTypeUuid: 'registration',
  referralOriginFacilityName: 'Establecimiento sintético',
  referralOriginRenaesCode: '00000000',
  concepts: { referralDestinationServiceUuid: 'service-question' },
};
const patientResult: ReturnType<typeof usePatient> = {
  patientUuid: 'patient',
  patient: { resourceType: 'Patient', id: 'patient', name: [{ given: ['Paciente'], family: 'Sintético' }] },
  isLoading: false,
  error: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useConfig).mockReset().mockReturnValue(config);
  vi.mocked(usePatient).mockReset().mockReturnValue(patientResult);
  vi.mocked(fetchOutpatientVisitSummarySource).mockReset().mockResolvedValue(structuredClone(source));
  vi.mocked(createInstitutionalReferralPdf)
    .mockReset()
    .mockResolvedValue(new Uint8Array([1, 2, 3]));
});

it('prints services from the fresh selected referral instead of the displayed history snapshot', async () => {
  render(<InstitutionalReferralDownload entry={entry} patientUuid="patient" />);
  await userEvent.click(screen.getByRole('button', { name: 'Descargar hoja de referencia' }));
  await waitFor(() => expect(downloadInstitutionalReferralPdf).toHaveBeenCalledOnce());
  expect(createInstitutionalReferralPdf).toHaveBeenCalledWith(
    expect.objectContaining({
      referral: expect.objectContaining({ originService: 'UPSS Emergencia', destinationService: 'Consulta Externa' }),
    }),
    expect.any(String),
  );
});

it.each(['services', 'patient', 'read'])(
  'blocks printing and reports a safe error for unverified %s',
  async (failure) => {
    const invalid = structuredClone(source);
    const encounter = invalid.encounters?.[0];
    if (!encounter) throw new Error('Invalid synthetic fixture');
    if (failure === 'services') encounter.obs = [];
    if (failure === 'patient') invalid.patient = { uuid: 'different-patient' };
    if (failure === 'read')
      vi.mocked(fetchOutpatientVisitSummarySource).mockRejectedValue(new Error('PRIVATE_RESPONSE'));
    else vi.mocked(fetchOutpatientVisitSummarySource).mockResolvedValue(invalid);
    render(<InstitutionalReferralDownload entry={entry} patientUuid="patient" />);
    await userEvent.click(screen.getByRole('button', { name: 'Descargar hoja de referencia' }));
    await waitFor(() => expect(showSnackbar).toHaveBeenCalledWith(expect.objectContaining({ kind: 'error' })));
    expect(createInstitutionalReferralPdf).not.toHaveBeenCalled();
    expect(downloadInstitutionalReferralPdf).not.toHaveBeenCalled();
    expect(JSON.stringify(vi.mocked(showSnackbar).mock.calls)).not.toContain('PRIVATE_RESPONSE');
  },
);

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

it('does not generate or download a document after the patient changes during the read', async () => {
  const pending = deferred<VisitSummarySource>();
  vi.mocked(fetchOutpatientVisitSummarySource).mockReturnValueOnce(pending.promise);
  const { rerender } = render(<InstitutionalReferralDownload entry={entry} patientUuid="patient" />);
  await userEvent.click(screen.getByRole('button', { name: 'Descargar hoja de referencia' }));
  rerender(<InstitutionalReferralDownload entry={entry} patientUuid="another-patient" />);
  await act(async () => pending.resolve(structuredClone(source)));
  expect(createInstitutionalReferralPdf).not.toHaveBeenCalled();
  expect(downloadInstitutionalReferralPdf).not.toHaveBeenCalled();
  expect(showSnackbar).not.toHaveBeenCalled();
});

it.each(['reference', 'visit', 'content', 'institution'])(
  'discards the pending PDF when the %s changes',
  async (change) => {
    const pending = deferred<Uint8Array>();
    vi.mocked(createInstitutionalReferralPdf).mockReturnValueOnce(pending.promise);
    const { rerender } = render(<InstitutionalReferralDownload entry={entry} patientUuid="patient" />);
    await userEvent.click(screen.getByRole('button', { name: 'Descargar hoja de referencia' }));
    await waitFor(() => expect(createInstitutionalReferralPdf).toHaveBeenCalledOnce());
    const nextEntry = {
      ...entry,
      ...(change === 'reference' ? { uuid: 'other-referral' } : {}),
      ...(change === 'visit' ? { visitUuid: 'other-visit' } : {}),
      ...(change === 'content' ? { referralReason: 'Motivo sintético corregido' } : {}),
    };
    if (change === 'institution') {
      vi.mocked(useConfig).mockReturnValue({ ...config, referralOriginFacilityName: 'Otra institución sintética' });
    }
    rerender(<InstitutionalReferralDownload entry={nextEntry} patientUuid="patient" />);
    await act(async () => pending.resolve(new Uint8Array([9])));
    expect(downloadInstitutionalReferralPdf).not.toHaveBeenCalled();
    expect(showSnackbar).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Descargar hoja de referencia' })).toBeEnabled();
  },
);

it.each(['read', 'pdf'])('discards a pending %s after unmount', async (stage) => {
  const reading = deferred<VisitSummarySource>();
  const creating = deferred<Uint8Array>();
  if (stage === 'read') vi.mocked(fetchOutpatientVisitSummarySource).mockReturnValueOnce(reading.promise);
  else vi.mocked(createInstitutionalReferralPdf).mockReturnValueOnce(creating.promise);
  const { unmount } = render(<InstitutionalReferralDownload entry={entry} patientUuid="patient" />);
  await userEvent.click(screen.getByRole('button', { name: 'Descargar hoja de referencia' }));
  if (stage === 'pdf') await waitFor(() => expect(createInstitutionalReferralPdf).toHaveBeenCalledOnce());
  unmount();
  await act(async () => {
    reading.resolve(structuredClone(source));
    creating.resolve(new Uint8Array([9]));
  });
  expect(downloadInstitutionalReferralPdf).not.toHaveBeenCalled();
  expect(showSnackbar).not.toHaveBeenCalled();
});

it('does not show an error from a discarded operation or clear a newer operation', async () => {
  const oldPdf = deferred<Uint8Array>();
  const currentPdf = deferred<Uint8Array>();
  vi.mocked(createInstitutionalReferralPdf).mockReturnValueOnce(oldPdf.promise).mockReturnValueOnce(currentPdf.promise);
  const { rerender } = render(<InstitutionalReferralDownload entry={entry} patientUuid="patient" />);
  await userEvent.click(screen.getByRole('button', { name: 'Descargar hoja de referencia' }));
  await waitFor(() => expect(createInstitutionalReferralPdf).toHaveBeenCalledOnce());
  rerender(<InstitutionalReferralDownload entry={entry} patientUuid="another-patient" />);
  // Returning to the same identity must not resurrect its old generation.
  rerender(<InstitutionalReferralDownload entry={entry} patientUuid="patient" />);
  await userEvent.click(screen.getByRole('button', { name: 'Descargar hoja de referencia' }));
  await waitFor(() => expect(createInstitutionalReferralPdf).toHaveBeenCalledTimes(2));
  await act(async () => oldPdf.reject(new Error('PRIVATE_OLD_RESPONSE')));
  expect(screen.getByRole('button', { name: 'Generando...' })).toBeDisabled();
  expect(showSnackbar).not.toHaveBeenCalled();
  expect(downloadInstitutionalReferralPdf).not.toHaveBeenCalled();
  await act(async () => currentPdf.resolve(new Uint8Array([7])));
  expect(downloadInstitutionalReferralPdf).toHaveBeenCalledExactlyOnceWith(new Uint8Array([7]), expect.any(String));
  expect(showSnackbar).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ kind: 'success' }));
});

it('keeps one generation during a duplicate click', async () => {
  const pending = deferred<VisitSummarySource>();
  vi.mocked(fetchOutpatientVisitSummarySource).mockReturnValueOnce(pending.promise);
  render(<InstitutionalReferralDownload entry={entry} patientUuid="patient" />);
  await userEvent.dblClick(screen.getByRole('button', { name: 'Descargar hoja de referencia' }));
  expect(fetchOutpatientVisitSummarySource).toHaveBeenCalledOnce();
  await act(async () => pending.resolve(structuredClone(source)));
  await waitFor(() => expect(downloadInstitutionalReferralPdf).toHaveBeenCalledOnce());
});

it('explains unsupported characters without suggesting that a damaged document was downloaded', async () => {
  vi.mocked(createInstitutionalReferralPdf).mockRejectedValueOnce(new OutpatientPdfUnsupportedCharacterError());
  render(<InstitutionalReferralDownload entry={entry} patientUuid="patient" />);
  await userEvent.click(screen.getByRole('button', { name: 'Descargar hoja de referencia' }));
  await waitFor(() =>
    expect(showSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'error',
        subtitle:
          'El documento contiene caracteres que no se pueden representar con seguridad. Revise el texto registrado o contacte a soporte.',
      }),
    ),
  );
  expect(downloadInstitutionalReferralPdf).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Descargar hoja de referencia' })).toBeEnabled();
});

it('completes the download when config is recreated with equivalent values on every render', async () => {
  vi.mocked(useConfig).mockImplementation(() => structuredClone(config));
  render(<InstitutionalReferralDownload entry={entry} patientUuid="patient" />);
  await userEvent.click(screen.getByRole('button', { name: 'Descargar hoja de referencia' }));
  await waitFor(() => expect(downloadInstitutionalReferralPdf).toHaveBeenCalledOnce());
});

it('keeps a pending download when the reference and patient are recreated with equivalent values', async () => {
  const pending = deferred<Uint8Array>();
  vi.mocked(createInstitutionalReferralPdf).mockReturnValueOnce(pending.promise);
  const { rerender } = render(<InstitutionalReferralDownload entry={entry} patientUuid="patient" />);
  await userEvent.click(screen.getByRole('button', { name: 'Descargar hoja de referencia' }));
  await waitFor(() => expect(createInstitutionalReferralPdf).toHaveBeenCalledOnce());
  vi.mocked(usePatient).mockReturnValue(structuredClone(patientResult));
  rerender(<InstitutionalReferralDownload entry={{ ...entry }} patientUuid="patient" />);
  expect(screen.getByRole('button', { name: 'Generando...' })).toBeDisabled();
  await act(async () => pending.resolve(new Uint8Array([8])));
  expect(downloadInstitutionalReferralPdf).toHaveBeenCalledExactlyOnceWith(new Uint8Array([8]), expect.any(String));
});

it.each(['name', 'identifier'])('discards a pending PDF if the patient %s changes', async (field) => {
  const pending = deferred<Uint8Array>();
  vi.mocked(createInstitutionalReferralPdf).mockReturnValueOnce(pending.promise);
  const { rerender } = render(<InstitutionalReferralDownload entry={entry} patientUuid="patient" />);
  await userEvent.click(screen.getByRole('button', { name: 'Descargar hoja de referencia' }));
  await waitFor(() => expect(createInstitutionalReferralPdf).toHaveBeenCalledOnce());
  const updated = structuredClone(patientResult);
  if (!updated.patient) throw new Error('Invalid synthetic fixture');
  if (field === 'name') updated.patient.name = [{ given: ['Nombre'], family: 'Corregido' }];
  else updated.patient.identifier = [{ value: 'SYNTHETIC-ID' }];
  vi.mocked(usePatient).mockReturnValue(updated);
  rerender(<InstitutionalReferralDownload entry={entry} patientUuid="patient" />);
  await act(async () => pending.resolve(new Uint8Array([9])));
  expect(downloadInstitutionalReferralPdf).not.toHaveBeenCalled();
  expect(showSnackbar).not.toHaveBeenCalled();
});
