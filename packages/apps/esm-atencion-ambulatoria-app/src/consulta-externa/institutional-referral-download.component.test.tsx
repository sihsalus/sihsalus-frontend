import { showSnackbar, useConfig, usePatient } from '@openmrs/esm-framework';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReferralEntry } from '../hooks/useReferralCounterReferral';
import InstitutionalReferralDownload from './institutional-referral-download.component';
import { createInstitutionalReferralPdf, downloadInstitutionalReferralPdf } from './institutional-referral-pdf';
import { fetchOutpatientVisitSummarySource, type VisitSummarySource } from './outpatient-visit-summary.resource';

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

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useConfig).mockReturnValue({
    visitTypes: { ambulatory: 'ambulatory' },
    encounterTypes: { referralCounterReferral: 'referral-type', visitNote: 'visit-note' },
    formsList: { visitNoteFormUuid: 'note-form' },
    clinicianEncounterRoleUuid: 'clinician',
    professionalRegistrationProviderAttributeTypeUuid: 'registration',
    referralOriginFacilityName: 'Establecimiento sintético',
    referralOriginRenaesCode: '00000000',
    concepts: { referralDestinationServiceUuid: 'service-question' },
  });
  vi.mocked(usePatient).mockReturnValue({
    patient: { resourceType: 'Patient', id: 'patient', name: [{ given: ['Paciente'], family: 'Sintético' }] },
    isLoading: false,
    error: null,
  });
  vi.mocked(fetchOutpatientVisitSummarySource).mockResolvedValue(structuredClone(source));
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

it.each([
  'services',
  'patient',
  'read',
])('blocks printing and reports a safe error for unverified %s', async (failure) => {
  const invalid = structuredClone(source);
  const encounter = invalid.encounters?.[0];
  if (!encounter) throw new Error('Invalid synthetic fixture');
  if (failure === 'services') encounter.obs = [];
  if (failure === 'patient') invalid.patient = { uuid: 'different-patient' };
  if (failure === 'read') vi.mocked(fetchOutpatientVisitSummarySource).mockRejectedValue(new Error('PRIVATE_RESPONSE'));
  else vi.mocked(fetchOutpatientVisitSummarySource).mockResolvedValue(invalid);
  render(<InstitutionalReferralDownload entry={entry} patientUuid="patient" />);
  await userEvent.click(screen.getByRole('button', { name: 'Descargar hoja de referencia' }));
  await waitFor(() => expect(showSnackbar).toHaveBeenCalledWith(expect.objectContaining({ kind: 'error' })));
  expect(createInstitutionalReferralPdf).not.toHaveBeenCalled();
  expect(downloadInstitutionalReferralPdf).not.toHaveBeenCalled();
  expect(JSON.stringify(vi.mocked(showSnackbar).mock.calls)).not.toContain('PRIVATE_RESPONSE');
});
