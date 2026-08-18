import { navigate, useConfig, userHasAccess, useSession, useVisit } from '@openmrs/esm-framework';
import {
  fetchVisitInsurance,
  SELF_FINANCED_CONCEPT_UUID,
  SIS_ACCREDITATION_ACTIVE_CONCEPT_UUID,
  SIS_ACCREDITATION_PENDING_CONCEPT_UUID,
  SIS_CONCEPT_UUID,
} from '@openmrs/esm-patient-common-lib';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SisFinancingWarning from './sis-financing-warning.component';

vi.mock('@openmrs/esm-patient-common-lib', async () => {
  const actual = await vi.importActual('@openmrs/esm-patient-common-lib');

  return {
    ...actual,
    fetchVisitInsurance: vi.fn(),
  };
});

const mockFetchVisitInsurance = vi.mocked(fetchVisitInsurance);
const mockNavigate = vi.mocked(navigate);
const mockUseConfig = vi.mocked(useConfig);
const mockUseSession = vi.mocked(useSession);
const mockUserHasAccess = vi.mocked(userHasAccess);
const mockUseVisit = vi.mocked(useVisit);

// SWR cachea por clave; cada test usa una visita distinta para no heredar datos.
let visitCounter = 0;
function useNextVisit() {
  visitCounter += 1;
  mockUseVisit.mockReturnValue({ currentVisit: { uuid: `visit-${visitCounter}` } } as unknown as ReturnType<
    typeof useVisit
  >);
}

const warningTitle = /Cobertura SIS por regularizar/i;

describe('SisFinancingWarning', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useNextVisit();
    mockUseConfig.mockReturnValue({ showSisFinancingWarning: true } as unknown as ReturnType<typeof useConfig>);
    mockUseSession.mockReturnValue({ user: { display: 'qa' } } as unknown as ReturnType<typeof useSession>);
    mockUserHasAccess.mockReturnValue(true);
  });

  it('no renderiza nada cuando la bandera de configuración está deshabilitada', async () => {
    mockUseConfig.mockReturnValue({ showSisFinancingWarning: false } as unknown as ReturnType<typeof useConfig>);
    mockFetchVisitInsurance.mockResolvedValue({
      financiadorUuid: SIS_CONCEPT_UUID,
      insuranceNumber: null,
      accreditationStatusUuid: SIS_ACCREDITATION_PENDING_CONCEPT_UUID,
      accreditationCheckedAt: null,
    });

    const { container } = render(<SisFinancingWarning patientUuid="patient-1" />);

    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it('advierte y deriva a Caja cuando el SIS no está vigente', async () => {
    const user = userEvent.setup();
    mockFetchVisitInsurance.mockResolvedValue({
      financiadorUuid: SIS_CONCEPT_UUID,
      insuranceNumber: 'SIS-123',
      accreditationStatusUuid: SIS_ACCREDITATION_PENDING_CONCEPT_UUID,
      accreditationCheckedAt: '2026-08-01T10:00:00.000Z',
    });

    render(<SisFinancingWarning patientUuid="patient-1" />);

    expect(await screen.findByText(warningTitle)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Ir a Caja/i }));

    expect(mockNavigate).toHaveBeenCalledWith({ to: expect.stringContaining('home/billing') });
  });

  it('advierte cuando la visita activa no tiene financiador definido', async () => {
    mockFetchVisitInsurance.mockResolvedValue({
      financiadorUuid: null,
      insuranceNumber: null,
      accreditationStatusUuid: null,
      accreditationCheckedAt: null,
    });

    render(<SisFinancingWarning patientUuid="patient-1" />);

    expect(await screen.findByText(warningTitle)).toBeInTheDocument();
  });

  it('no advierte cuando el SIS está vigente y completo', async () => {
    mockFetchVisitInsurance.mockResolvedValue({
      financiadorUuid: SIS_CONCEPT_UUID,
      insuranceNumber: 'SIS-123',
      accreditationStatusUuid: SIS_ACCREDITATION_ACTIVE_CONCEPT_UUID,
      accreditationCheckedAt: '2026-08-01T10:00:00.000Z',
    });

    const { container } = render(<SisFinancingWarning patientUuid="patient-1" />);

    await waitFor(() => expect(mockFetchVisitInsurance).toHaveBeenCalled());
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it('no advierte cuando el financiador es distinto de SIS', async () => {
    mockFetchVisitInsurance.mockResolvedValue({
      financiadorUuid: SELF_FINANCED_CONCEPT_UUID,
      insuranceNumber: null,
      accreditationStatusUuid: null,
      accreditationCheckedAt: null,
    });

    const { container } = render(<SisFinancingWarning patientUuid="patient-1" />);

    await waitFor(() => expect(mockFetchVisitInsurance).toHaveBeenCalled());
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it('sin privilegio de Caja muestra la advertencia sin botón de derivación', async () => {
    mockUserHasAccess.mockReturnValue(false);
    mockFetchVisitInsurance.mockResolvedValue({
      financiadorUuid: SIS_CONCEPT_UUID,
      insuranceNumber: null,
      accreditationStatusUuid: SIS_ACCREDITATION_PENDING_CONCEPT_UUID,
      accreditationCheckedAt: null,
    });

    render(<SisFinancingWarning patientUuid="patient-1" />);

    expect(await screen.findByText(warningTitle)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Ir a Caja/i })).not.toBeInTheDocument();
  });

  it('no renderiza nada sin visita activa', async () => {
    mockUseVisit.mockReturnValue({ currentVisit: null } as unknown as ReturnType<typeof useVisit>);

    const { container } = render(<SisFinancingWarning patientUuid="patient-1" />);

    await waitFor(() => expect(container).toBeEmptyDOMElement());
    expect(mockFetchVisitInsurance).not.toHaveBeenCalled();
  });
});
