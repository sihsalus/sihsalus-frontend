import { launchWorkspace2, showSnackbar, useConfig, userHasAccess } from '@openmrs/esm-framework';
import { FormsSelectorWorkspace } from '@openmrs/esm-patient-common-lib';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { resolveMaternalForm } from '../../hooks/useMaternalFormLauncher';
import { formEntryWorkspace } from '../../types';
import MaternalHealthFormsSelectorWorkspace from './maternal-health-forms-selector.workspace';

const mockLaunchWorkspace2 = vi.mocked(launchWorkspace2);
const mockResolveMaternalForm = vi.mocked(resolveMaternalForm);
const mockShowSnackbar = vi.mocked(showSnackbar);
const mockUseConfig = useConfig as vi.Mock;
const mockUserHasAccess = vi.mocked(userHasAccess);
const mockFormsSelectorWorkspace = vi.mocked(FormsSelectorWorkspace);
const defaultWorkspaceProps = {
  closeWorkspace: vi.fn<() => Promise<boolean>>().mockResolvedValue(true),
};

vi.mock('@openmrs/esm-patient-common-lib', async () => {
  const originalModule = await vi.importActual('@openmrs/esm-patient-common-lib');

  return {
    ...originalModule,
    FormsSelectorWorkspace: vi.fn(({ availableForms, backWorkspace, onFormLaunch, subtitle, title }) => (
      <div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
        <span>backWorkspace:{String(backWorkspace)}</span>
        <span>forms:{availableForms.length}</span>
        {availableForms.map(({ form }) => (
          <button key={form.uuid} type="button" onClick={() => onFormLaunch(form, 'encounter-uuid', vi.fn())}>
            {form.display}
          </button>
        ))}
      </div>
    )),
  };
});

vi.mock('../../hooks/useCurrentPregnancy', () => ({
  useCurrentPregnancy: vi.fn(() => ({ pregnancyStartDate: '2026-01-01' })),
}));

vi.mock('../../hooks/useMaternalFormLauncher', () => ({
  resolveMaternalForm: vi.fn(),
}));

const resolvedCurrentPregnancyForm = {
  uuid: 'resolved-current-pregnancy-form-uuid',
  name: 'OBST-002-EMBARAZO ACTUAL',
  display: 'Embarazo actual',
  version: '1.0',
  published: true,
  retired: false,
  resources: [],
  formCategory: 'Maternal',
};

describe('MaternalHealthFormsSelectorWorkspace', () => {
  beforeEach(() => {
    mockLaunchWorkspace2.mockReset();
    mockShowSnackbar.mockReset();
    mockResolveMaternalForm.mockReset();
    mockResolveMaternalForm.mockResolvedValue(resolvedCurrentPregnancyForm);
    mockUserHasAccess.mockReturnValue(true);
    mockUseConfig.mockReturnValue({
      formsList: {
        maternalHistory: 'maternal-history-form-uuid',
        currentPregnancy: 'current-pregnancy-form-uuid',
        obstetricMonitor: 'obstetric-monitor-form-uuid',
        birthPlanForm: '',
      },
    });
  });

  it('only lists forms covered by the user edit privileges', () => {
    mockUserHasAccess.mockImplementation((privilege) => privilege === 'app:hoja.clinica.controlPrenatal.editar');

    render(<MaternalHealthFormsSelectorWorkspace {...defaultWorkspaceProps} />);

    expect(screen.getByText('forms:2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /antecedentes obst/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /embarazo actual/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /monitorizaci/i })).not.toBeInTheDocument();
  });

  it('passes configured maternal forms to the shared forms selector', () => {
    render(<MaternalHealthFormsSelectorWorkspace {...defaultWorkspaceProps} />);

    expect(screen.getByRole('heading', { name: /formularios de salud materna/i })).toBeInTheDocument();
    expect(screen.getByText(/seleccione el formulario de salud materna/i)).toBeInTheDocument();
    expect(screen.getByText('forms:3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /antecedentes obstétricos/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /embarazo actual/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /monitorización obstétrica/i })).toBeInTheDocument();
    expect(screen.getByText('backWorkspace:null')).toBeInTheDocument();
    expect(mockFormsSelectorWorkspace.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        patientAge: '',
        controlNumber: 0,
        backWorkspace: null,
      }),
    );
  });

  it('resolves the selected identifier and launches the complete published form', async () => {
    const user = userEvent.setup();

    render(<MaternalHealthFormsSelectorWorkspace {...defaultWorkspaceProps} />);

    await user.click(screen.getByRole('button', { name: /embarazo actual/i }));

    await waitFor(() =>
      expect(mockLaunchWorkspace2).toHaveBeenCalledWith(formEntryWorkspace, {
        form: resolvedCurrentPregnancyForm,
        encounterUuid: 'encounter-uuid',
        handlePostResponse: expect.any(Function),
      }),
    );
    expect(mockResolveMaternalForm).toHaveBeenCalledWith('current-pregnancy-form-uuid', 'Embarazo actual');
  });

  it('does not launch when the configured form cannot be verified', async () => {
    const user = userEvent.setup();
    mockResolveMaternalForm.mockRejectedValueOnce(new Error('SQLSTATE 500 internal metadata'));

    render(<MaternalHealthFormsSelectorWorkspace {...defaultWorkspaceProps} />);

    await user.click(screen.getByRole('button', { name: /embarazo actual/i }));

    await waitFor(() => expect(mockShowSnackbar).toHaveBeenCalled());
    expect(mockLaunchWorkspace2).not.toHaveBeenCalled();
    expect(mockShowSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'error',
        title: expect.not.stringContaining('SQLSTATE'),
        subtitle: expect.not.stringContaining('SQLSTATE'),
      }),
    );
  });
});
