import { getDefaultsFromConfigSchema, showSnackbar, UserHasAccess, useConfig, useVisit } from '@openmrs/esm-framework';
import { launchPatientWorkspace, launchStartVisitPrompt } from '@openmrs/esm-patient-common-lib';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { configSchema } from '../config-schema';
import { useDiagnosisHistory } from '../hooks/useDiagnosisHistory';
import { consultaExternaEditPrivilege, visitNotesFormWorkspace, visitNotesPrivilege } from '../utils/constants';
import DiagnosticoClasificado from './diagnostico-clasificado.component';

vi.mock('../hooks/useDiagnosisHistory', () => ({
  useDiagnosisHistory: vi.fn(),
}));

vi.mock('@openmrs/esm-patient-common-lib', async () => {
  const actual = await vi.importActual('@openmrs/esm-patient-common-lib');

  return {
    ...actual,
    launchPatientWorkspace: vi.fn(),
    launchStartVisitPrompt: vi.fn(),
  };
});

const mockLaunchPatientWorkspace = vi.mocked(launchPatientWorkspace);
const mockLaunchStartVisitPrompt = vi.mocked(launchStartVisitPrompt);
const mockShowSnackbar = vi.mocked(showSnackbar);
const mockUseConfig = vi.mocked(useConfig);
const mockUseDiagnosisHistory = vi.mocked(useDiagnosisHistory);
const mockUseVisit = vi.mocked(useVisit);

describe('DiagnosticoClasificado', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(UserHasAccess).mockImplementation(({ children }: { children?: ReactNode }) => children);
    mockUseConfig.mockReturnValue(getDefaultsFromConfigSchema(configSchema));
    mockUseDiagnosisHistory.mockReturnValue({
      diagnoses: [],
      isLoading: false,
      isValidating: false,
      error: undefined,
      mutate: vi.fn(),
      pagination: { currentPage: 1, totalPages: 1, onPageChange: vi.fn() },
      sourceErrors: [],
    } as unknown as ReturnType<typeof useDiagnosisHistory>);
  });

  it('launches Visit Notes for an active ambulatory visit and requires both editing privileges', async () => {
    const user = userEvent.setup();
    const ambulatoryVisitTypeUuid = getDefaultsFromConfigSchema(configSchema).visitTypes.ambulatory;
    mockUseVisit.mockReturnValue({
      currentVisit: { uuid: 'visit-uuid', visitType: { uuid: ambulatoryVisitTypeUuid } },
    } as unknown as ReturnType<typeof useVisit>);

    render(<DiagnosticoClasificado patientUuid="patient-uuid" />);

    await user.click(screen.getByRole('button', { name: /diagn[oó]stic/i }));

    expect(mockLaunchPatientWorkspace).toHaveBeenCalledWith(visitNotesFormWorkspace, { formContext: 'creating' });
    expect(mockLaunchStartVisitPrompt).not.toHaveBeenCalled();
    expect(mockShowSnackbar).not.toHaveBeenCalled();
    expect(
      vi
        .mocked(UserHasAccess)
        .mock.calls.some(
          ([props]) =>
            JSON.stringify(props.privilege) === JSON.stringify([consultaExternaEditPrivilege, visitNotesPrivilege]),
        ),
    ).toBe(true);
  });

  it('opens the standard visit prompt instead of launching a diagnosis without an active visit', async () => {
    const user = userEvent.setup();
    mockUseVisit.mockReturnValue({ currentVisit: null } as unknown as ReturnType<typeof useVisit>);

    render(<DiagnosticoClasificado patientUuid="patient-uuid" />);
    await user.click(screen.getByRole('button', { name: /diagn[oó]stic/i }));

    expect(mockLaunchStartVisitPrompt).toHaveBeenCalledOnce();
    expect(mockLaunchPatientWorkspace).not.toHaveBeenCalled();
  });

  it('fails closed when the active visit is not ambulatory', async () => {
    const user = userEvent.setup();
    mockUseVisit.mockReturnValue({
      currentVisit: { uuid: 'visit-uuid', visitType: { uuid: 'inpatient-visit-type' } },
    } as unknown as ReturnType<typeof useVisit>);

    render(<DiagnosticoClasificado patientUuid="patient-uuid" />);
    await user.click(screen.getByRole('button', { name: /diagn[oó]stic/i }));

    expect(mockLaunchPatientWorkspace).not.toHaveBeenCalled();
    expect(mockLaunchStartVisitPrompt).not.toHaveBeenCalled();
    expect(mockShowSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'error', title: expect.any(String), subtitle: expect.any(String) }),
    );
  });

  it('fails closed when the ambulatory visit type is not configured', async () => {
    const user = userEvent.setup();
    const config = getDefaultsFromConfigSchema(configSchema);
    mockUseConfig.mockReturnValue({ ...config, visitTypes: { ...config.visitTypes, ambulatory: '' } });
    mockUseVisit.mockReturnValue({
      currentVisit: { uuid: 'visit-uuid', visitType: { uuid: 'visit-type' } },
    } as unknown as ReturnType<typeof useVisit>);

    render(<DiagnosticoClasificado patientUuid="patient-uuid" />);
    await user.click(screen.getByRole('button', { name: /diagn[oó]stic/i }));

    expect(mockLaunchPatientWorkspace).not.toHaveBeenCalled();
    expect(mockShowSnackbar).toHaveBeenCalledWith(expect.objectContaining({ kind: 'error' }));
  });
});
