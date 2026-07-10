import { launchWorkspace2, useConfig } from '@openmrs/esm-framework';
import { FormsSelectorWorkspace } from '@openmrs/esm-patient-common-lib';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { formEntryWorkspace } from '../../types';
import MaternalHealthFormsSelectorWorkspace from './maternal-health-forms-selector.workspace';

const mockLaunchWorkspace2 = vi.mocked(launchWorkspace2);
const mockUseConfig = useConfig as vi.Mock;
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

describe('MaternalHealthFormsSelectorWorkspace', () => {
  beforeEach(() => {
    mockUseConfig.mockReturnValue({
      formsList: {
        maternalHistory: 'maternal-history-form-uuid',
        currentPregnancy: 'current-pregnancy-form-uuid',
        obstetricMonitor: 'obstetric-monitor-form-uuid',
        birthPlanForm: '',
      },
    });
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

  it('launches form entry with the selected form uuid and encounter', async () => {
    const user = userEvent.setup();

    render(<MaternalHealthFormsSelectorWorkspace {...defaultWorkspaceProps} />);

    await user.click(screen.getByRole('button', { name: /embarazo actual/i }));

    expect(mockLaunchWorkspace2).toHaveBeenCalledWith(formEntryWorkspace, {
      form: { uuid: 'current-pregnancy-form-uuid' },
      encounterUuid: 'encounter-uuid',
      handlePostResponse: expect.any(Function),
    });
  });
});
