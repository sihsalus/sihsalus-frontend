import { launchWorkspace2, useConfig } from '@openmrs/esm-framework';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { PropsWithChildren } from 'react';
import { useAmbulatoryVisitGuard } from '../hooks';
import { useReferralCounterReferral } from '../hooks/useReferralCounterReferral';
import ReferenciaContraReferencia from './referencia-contrarreferencia.component';

vi.mock('@sihsalus/esm-rbac', () => ({
  RequirePrivilege: ({ children }: PropsWithChildren) => children,
}));

vi.mock('../hooks', () => ({
  useAmbulatoryVisitGuard: vi.fn(),
}));

vi.mock('../hooks/useReferralCounterReferral', () => ({
  useReferralCounterReferral: vi.fn(),
}));

vi.mock('./institutional-referral-download.component', () => ({
  default: () => <button type="button">Descargar hoja de referencia</button>,
}));

const mockUseConfig = vi.mocked(useConfig);
const mockUseAmbulatoryVisitGuard = vi.mocked(useAmbulatoryVisitGuard);
const mockUseReferralCounterReferral = vi.mocked(useReferralCounterReferral);
const mockLaunchWorkspace2 = vi.mocked(launchWorkspace2);
const mutate = vi.fn();
const pagination = { currentPage: 1, totalPages: 1, onPageChange: vi.fn() };

describe('ReferenciaContraReferencia', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseConfig.mockReturnValue({
      encounterTypes: { referralCounterReferral: 'referral-encounter' },
      formsList: { referralForm: 'CE-REF-001-REFERENCIA-CONTRARREFERENCIA' },
      visitTypes: { ambulatory: 'ambulatory-visit' },
      concepts: {
        referralTypeUuid: 'referral-type',
        referralReasonUuid: 'referral-reason',
        referralDestinationUuid: 'referral-destination',
        counterReferralResponseUuid: 'counter-referral-response',
        counterReferralConditionUuid: 'counter-referral-condition',
      },
    });
    mockUseAmbulatoryVisitGuard.mockReturnValue({
      requireAmbulatoryVisit: () =>
        ({
          uuid: 'visit-uuid',
          startDatetime: '2026-08-25T09:00:00.000Z',
          visitType: { uuid: 'ambulatory-visit' },
          location: { uuid: 'location-uuid' },
        }) as never,
    });
    mockUseReferralCounterReferral.mockReturnValue({
      entries: [
        {
          uuid: 'referral-uuid',
          visitUuid: 'visit-uuid',
          encounterDatetime: '2026-08-25T10:00:00.000Z',
          provider: 'Dra. Perez',
          referralType: 'Urgencia',
          referralReason: 'Evaluación especializada',
          referralDestination: 'Hospital Regional de Loreto',
          referralDestinationCode: '00000003',
          referralDestinationSpecialty: 'Cirugía',
          referralDestinationSpecialtyOther: null,
          referralPatientCondition: 'Estable',
          referralTransportMode: 'Fluvial',
          counterReferralResponse: 'Retorna para seguimiento',
          counterReferralCondition: 'Mejorado',
        },
      ],
      isLoading: false,
      isValidating: false,
      error: undefined,
      mutate,
      pagination,
      sourceErrors: [],
    });
  });

  it('shows issued referrals separately and opens the institutional referral sheet', async () => {
    const user = userEvent.setup();

    render(<ReferenciaContraReferencia patientUuid="patient-uuid" />);

    expect(screen.getByRole('heading', { name: 'Referencias emitidas' })).toBeInTheDocument();
    expect(screen.getByText('Hospital Regional de Loreto')).toBeInTheDocument();
    expect(screen.getByText('00000003')).toBeInTheDocument();
    expect(screen.getByText('Fluvial')).toBeInTheDocument();
    expect(screen.queryByText('Retorna para seguimiento')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Registrar referencia/i }));

    expect(mockLaunchWorkspace2).toHaveBeenCalledWith('institutional-referral-form-workspace', {
      patientUuid: 'patient-uuid',
      visitUuid: 'visit-uuid',
      locationUuid: 'location-uuid',
      onAfterSave: mutate,
    });
  });

  it('shows the linked counter-referral response in its dedicated view', async () => {
    const user = userEvent.setup();
    render(<ReferenciaContraReferencia patientUuid="patient-uuid" />);

    await user.click(screen.getByRole('tab', { name: 'Contrarreferencias recibidas' }));

    expect(mockUseReferralCounterReferral).toHaveBeenLastCalledWith(
      'patient-uuid',
      'referral-encounter',
      expect.any(Object),
      'counterReferrals',
    );
    expect(screen.getByText('Retorna para seguimiento')).toBeInTheDocument();
    expect(screen.getByText('Mejorado')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Registrar referencia/i })).not.toBeInTheDocument();
  });
});
