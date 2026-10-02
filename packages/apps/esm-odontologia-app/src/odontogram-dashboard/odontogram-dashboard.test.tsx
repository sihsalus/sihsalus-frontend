import { launchWorkspace, userHasAccess, useSession } from '@openmrs/esm-framework';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { useOdontogramEncounter } from '../hooks/useOdontogramEncounter';
import { useOdontogramHistory } from '../hooks/useOdontogramHistory';
import OdontogramDashboard from './odontogram-dashboard.component';
import { adultConfig } from '../odontogram/config/adultConfig';
import { childConfig } from '../odontogram/config/childConfig';
import { createEmptyOdontogramData } from '../odontogram/types/odontogram';
import useOdontogramDataStore from '../store/odontogramDataStore';
import type { OdontogramRecord } from '../types/odontogram-record';

vi.mock('../hooks/useOdontogramEncounter');
vi.mock('../hooks/useOdontogramHistory');
vi.mock('../odontogram/components/Odontogram', async (importOriginal) => {
  const { default: Canvas } = await importOriginal<typeof import('../odontogram/components/Odontogram')>();
  return {
    default: (props: React.ComponentProps<typeof Canvas>) => (
      <div data-testid="odontogram-canvas" data-read-only={String(Boolean(props.readOnly))}>
        <Canvas {...props} />
      </div>
    ),
  };
});
vi.mock('./odontogram-record-list.component', () => ({
  default: ({
    groups,
    onAddAttention,
    onSelectBase,
  }: {
    groups: Array<{ base: OdontogramRecord }>;
    onAddAttention: (record: OdontogramRecord) => void;
    onSelectBase: (record: OdontogramRecord) => void;
  }) => (
    <div data-testid="odontogram-record-list">
      {groups.map(({ base }) => (
        <div key={base.encounterUuid}>
          <button type="button" onClick={() => onAddAttention(base)}>
            New attention {base.encounterUuid}
          </button>
          <button type="button" onClick={() => onSelectBase(base)}>
            View {base.encounterUuid}
          </button>
        </div>
      ))}
    </div>
  ),
}));

const mockUseSession = vi.mocked(useSession);
const mockUserHasAccess = vi.mocked(userHasAccess);
const mockLaunchWorkspace = vi.mocked(launchWorkspace);
const mockUseOdontogramEncounter = vi.mocked(useOdontogramEncounter);
const mockUseOdontogramHistory = vi.mocked(useOdontogramHistory);

describe('OdontogramDashboard', () => {
  beforeEach(() => {
    useOdontogramDataStore.setState({
      currentPatientUuid: null,
      selectedEncounterUuid: null,
      activeBaseEncounterUuid: null,
      data: createEmptyOdontogramData(adultConfig),
    });
    useOdontogramDataStore.getState().resetFormSelection();
    mockUseSession.mockReturnValue({ user: { uuid: 'user-uuid' } } as ReturnType<typeof useSession>);
    mockUserHasAccess.mockReturnValue(true);
    mockUseOdontogramEncounter.mockReturnValue({
      error: null,
      isSaving: false,
      save: vi.fn(),
    });
    mockUseOdontogramHistory.mockReturnValue({
      attentionRecords: [],
      baseRecords: [],
      error: null,
      groups: [],
      isLoading: false,
      mutate: vi.fn(),
    });
  });

  it('opens the editable canvas when registering the first odontogram', async () => {
    const user = userEvent.setup();
    render(<OdontogramDashboard patientUuid="patient-uuid" />);

    await user.click(screen.getByRole('button', { name: /registrar odontograma inicial/i }));

    expect(screen.getByTestId('odontogram-canvas')).toHaveAttribute('data-read-only', 'false');
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeEnabled();
    expect(screen.queryByText(/no hay odontograma inicial registrado/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /editar en pantalla completa/i }));

    expect(mockLaunchWorkspace).toHaveBeenCalledWith(
      'odontologia-odontogram-form-workspace',
      expect.objectContaining({ patientUuid: 'patient-uuid', workspaceMode: 'base' }),
    );
  });

  it('does not offer a new odontogram when history failed to load', () => {
    mockUseOdontogramHistory.mockReturnValue({
      attentionRecords: [],
      baseRecords: [],
      error: new Error('Synthetic internal history failure'),
      groups: [],
      isLoading: false,
      mutate: vi.fn(),
    });
    render(<OdontogramDashboard patientUuid="synthetic-child" />);
    expect(screen.queryByRole('button', { name: /registrar odontograma inicial/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/no hay odontograma inicial registrado/i)).not.toBeInTheDocument();
    expect(screen.queryByText('Synthetic internal history failure')).not.toBeInTheDocument();
    expect(mockUseOdontogramEncounter().save).not.toHaveBeenCalled();
  });

  it('preserves the dental draft through a failed history refresh', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<OdontogramDashboard patientUuid="synthetic-child" />);
    await user.click(screen.getByRole('button', { name: /registrar odontograma inicial/i }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Dentition' }), 'child');
    const draft = useOdontogramDataStore.getState().data;
    const history = mockUseOdontogramHistory();
    mockUseOdontogramHistory.mockReturnValue({ ...history, error: new Error('Synthetic refresh failure') });
    rerender(<OdontogramDashboard patientUuid="synthetic-child" />);
    expect(screen.queryByRole('button', { name: 'Guardar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /registrar odontograma inicial/i })).not.toBeInTheDocument();
    mockUseOdontogramHistory.mockReturnValue(history);
    rerender(<OdontogramDashboard patientUuid="synthetic-child" />);
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeEnabled();
    expect(useOdontogramDataStore.getState().data).toEqual(draft);
    expect(screen.getByText('55')).toBeInTheDocument();
  });
  it('saves and expands the chosen primary dentition from the first initial record', async () => {
    const user = userEvent.setup();
    render(<OdontogramDashboard patientUuid="patient-uuid" />);
    await user.click(screen.getByRole('button', { name: /registrar odontograma inicial/i }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Dentition' }), 'child');
    await user.click(screen.getByTestId('expand-odontogram-btn'));
    expect(mockLaunchWorkspace).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        initialData: createEmptyOdontogramData(childConfig),
        workspaceMode: 'base',
      }),
    );
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(mockUseOdontogramEncounter().save).toHaveBeenCalledWith(
      expect.objectContaining({
        patientUuid: 'patient-uuid',
        recordType: 'base',
        data: createEmptyOdontogramData(childConfig),
      }),
    );
  });

  it('inherits primary dentition in a new evolutive record and preserves it across historical navigation', async () => {
    const user = userEvent.setup();
    const primary = {
      encounterUuid: 'primary-base',
      type: 'base' as const,
      date: '2026-09-22',
      label: 'Primary',
      data: createEmptyOdontogramData(childConfig),
    };
    const permanent = {
      ...primary,
      encounterUuid: 'permanent-base',
      date: '2026-08-01',
      data: createEmptyOdontogramData(adultConfig),
    };
    mockUseOdontogramHistory.mockReturnValue({
      attentionRecords: [],
      baseRecords: [permanent, primary],
      error: null,
      isLoading: false,
      mutate: vi.fn(),
      groups: [
        { base: permanent, attentions: [] },
        { base: primary, attentions: [] },
      ],
    });
    render(<OdontogramDashboard patientUuid="patient-uuid" />);
    expect(screen.getByText('55')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'New attention primary-base' }));
    expect(screen.queryByRole('combobox', { name: 'Dentition' })).not.toBeInTheDocument();
    expect(screen.getByText('55')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'View permanent-base' }));
    expect(screen.getByText('18')).toBeInTheDocument();
    expect(useOdontogramDataStore.getState().data.dentition).toBe('child');
    await user.click(screen.getByTestId('continue-edit-btn'));
    expect(screen.getByText('55')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(mockUseOdontogramEncounter().save).toHaveBeenCalledWith(
      expect.objectContaining({
        recordType: 'attention',
        baseEncounterUuid: 'primary-base',
        data: createEmptyOdontogramData(childConfig),
      }),
    );
  });

  it('does not offer initial-record creation without the existing edit privilege', () => {
    mockUserHasAccess.mockReturnValue(false);
    render(<OdontogramDashboard patientUuid="patient-uuid" />);
    expect(screen.queryByRole('button', { name: /registrar odontograma inicial/i })).not.toBeInTheDocument();
    expect(screen.queryByTestId('odontogram-canvas')).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Dentition' })).not.toBeInTheDocument();
  });
});
