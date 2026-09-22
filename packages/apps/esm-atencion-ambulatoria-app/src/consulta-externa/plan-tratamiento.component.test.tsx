import { getDefaultsFromConfigSchema, UserHasAccess, useConfig, userHasAccess } from '@openmrs/esm-framework';
import { useLaunchWorkspaceRequiringVisit } from '@openmrs/esm-patient-common-lib';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { configSchema } from '../config-schema';
import { useConsultaExternaVisitNoteLauncher } from '../hooks/useConsultaExternaVisitNoteLauncher';
import { useTreatmentPlan } from '../hooks/useTreatmentPlan';
import { consultaExternaEditPrivilege, visitNotesEditPrivilege } from '../utils/constants';
import PlanTratamiento from './plan-tratamiento.component';

vi.mock('@openmrs/esm-patient-common-lib', async () => ({
  ...(await vi.importActual('@openmrs/esm-patient-common-lib')),
  useLaunchWorkspaceRequiringVisit: vi.fn(),
}));

vi.mock('../hooks/useTreatmentPlan', () => ({
  useTreatmentPlan: vi.fn(),
}));

vi.mock('../hooks/useConsultaExternaVisitNoteLauncher', () => ({
  useConsultaExternaVisitNoteLauncher: vi.fn(),
}));

const mockUseConfig = vi.mocked(useConfig);
const mockUserHasAccess = vi.mocked(userHasAccess);
const mockUseConsultaExternaVisitNoteLauncher = vi.mocked(useConsultaExternaVisitNoteLauncher);
const mockUseTreatmentPlan = vi.mocked(useTreatmentPlan);
const mockLaunchVisitNote = vi.fn();
const mockLaunchMedications = vi.fn();

describe('PlanTratamiento — order basket action', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(UserHasAccess).mockImplementation(({ children }: { children?: ReactNode }) => children);
    mockUseConfig.mockReturnValue(getDefaultsFromConfigSchema(configSchema));
    vi.mocked(useLaunchWorkspaceRequiringVisit).mockReturnValue(mockLaunchMedications);
    mockUseConsultaExternaVisitNoteLauncher.mockReturnValue(mockLaunchVisitNote);
    mockUseTreatmentPlan.mockReturnValue({
      treatmentPlans: [],
      isLoading: false,
      isValidating: false,
      error: undefined,
      mutate: vi.fn(),
      pagination: { currentPage: 1, totalPages: 1, onPageChange: vi.fn() },
      sourceErrors: [],
    } as unknown as ReturnType<typeof useTreatmentPlan>);
  });

  it('offers the prescribe action to a user who can edit orders', () => {
    mockUserHasAccess.mockReturnValue(true);

    render(<PlanTratamiento patientUuid="patient-uuid" />);

    expect(screen.getByRole('button', { name: /prescribir medicamentos/i })).toBeInTheDocument();
    expect(mockUserHasAccess.mock.calls[0][0]).toEqual([
      'app:hoja.clinica.canastaOrdenes',
      'app:hoja.clinica.ordenes.editar',
      'app:hoja.clinica.medicamentos.editar',
    ]);
  });

  it('opens medication search for this patient through the visit guard, with a return to the shared basket', async () => {
    const user = userEvent.setup();
    mockUserHasAccess.mockReturnValue(true);
    const { rerender } = render(<PlanTratamiento patientUuid="synthetic-patient-a" />);
    await user.click(screen.getByRole('button', { name: /prescribir medicamentos/i }));
    expect(useLaunchWorkspaceRequiringVisit).toHaveBeenLastCalledWith('synthetic-patient-a', 'add-drug-order');
    expect(mockLaunchMedications).toHaveBeenCalledExactlyOnceWith({ returnToOrderBasket: true });
    expect(mockLaunchVisitNote).not.toHaveBeenCalled();

    rerender(<PlanTratamiento patientUuid="synthetic-patient-b" />);
    expect(useLaunchWorkspaceRequiringVisit).toHaveBeenLastCalledWith('synthetic-patient-b', 'add-drug-order');
  });

  it.each([
    'app:hoja.clinica.canastaOrdenes',
    'app:hoja.clinica.ordenes.editar',
    'app:hoja.clinica.medicamentos.editar',
  ])('does not offer prescribing when %s is missing', (missingPrivilege) => {
    mockUserHasAccess.mockImplementation((privileges) => ![privileges].flat().includes(missingPrivilege));
    render(<PlanTratamiento patientUuid="synthetic-patient" />);
    expect(screen.queryByRole('button', { name: /prescribir medicamentos/i })).not.toBeInTheDocument();
    expect(mockLaunchMedications).not.toHaveBeenCalled();
  });

  it('hides the prescribe action without the ordering privilege, so no visit is started for a launch that would fail', () => {
    mockUserHasAccess.mockReturnValue(false);

    render(<PlanTratamiento patientUuid="patient-uuid" />);

    expect(screen.queryByRole('button', { name: /prescribir medicamentos/i })).not.toBeInTheDocument();
  });

  it('opens the canonical visit summary for plan data and keeps the order basket as a separate action', async () => {
    const user = userEvent.setup();
    mockUserHasAccess.mockReturnValue(true);

    render(<PlanTratamiento patientUuid="patient-uuid" />);

    await user.click(screen.getByRole('button', { name: /(?:record|registrar) plan/i }));

    expect(mockUseConsultaExternaVisitNoteLauncher).toHaveBeenCalledWith({
      patientUuid: 'patient-uuid',
      ambulatoryVisitTypeUuid: getDefaultsFromConfigSchema(configSchema).visitTypes.ambulatory,
      mutate: expect.any(Function),
    });
    expect(mockLaunchVisitNote).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: /prescribir medicamentos/i })).toBeInTheDocument();
    expect(
      vi
        .mocked(UserHasAccess)
        .mock.calls.some(
          ([props]) =>
            JSON.stringify(props.privilege) === JSON.stringify([consultaExternaEditPrivilege, visitNotesEditPrivilege]),
        ),
    ).toBe(true);
  });
});
