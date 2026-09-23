import {
  getSessionStore,
  launchWorkspace2,
  openmrsFetch,
  showSnackbar,
  useConfig,
  userHasAccess,
  useSession,
} from '@openmrs/esm-framework';
import { FormsSelectorWorkspace } from '@openmrs/esm-patient-common-lib';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mockSession } from 'test-utils';
import type { Mock } from 'vitest';
import { useCurrentPregnancy } from '../../hooks/useCurrentPregnancy';
import { formEntryWorkspace } from '../../types';
import MaternalHealthFormsSelectorWorkspace from './maternal-health-forms-selector.workspace';

const mockLaunchWorkspace2 = vi.mocked(launchWorkspace2);
const mockUseConfig = useConfig as Mock;
const mockUserHasAccess = vi.mocked(userHasAccess);
const mockFormsSelectorWorkspace = vi.mocked(FormsSelectorWorkspace);
const mockOnFormSubmitted = vi.hoisted(() => vi.fn());
const mockOpenmrsFetch = vi.mocked(openmrsFetch);
const currentPregnancyForm = {
  uuid: '00000000-0000-4000-8000-000000000002',
  name: 'OBST-CURRENT-PREGNANCY',
  display: 'Embarazo actual',
  published: true,
  retired: false,
};
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
          <button
            key={form.uuid}
            type="button"
            onClick={() => onFormLaunch(form, 'encounter-uuid', mockOnFormSubmitted)}
          >
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
    vi.mocked(useSession).mockReturnValue(mockSession.data);
    getSessionStore().setState({ loaded: true, session: mockSession.data });
    mockUserHasAccess.mockReturnValue(true);
    mockOpenmrsFetch.mockResolvedValue({
      data: currentPregnancyForm,
    } as Awaited<ReturnType<typeof openmrsFetch>>);
    mockUseConfig.mockReturnValue({
      formsList: {
        maternalHistory: 'maternal-history-form-uuid',
        currentPregnancy: currentPregnancyForm.uuid,
        obstetricMonitor: 'obstetric-monitor-form-uuid',
        postpartumControl: 'postpartum-control-form-uuid',
        birthPlanForm: '   ',
      },
    });
  });

  afterEach(() => getSessionStore().setState({ loaded: false, session: null }));

  it.each([
    { family: 'controlPrenatal', labels: [/antecedentes obst/i, /embarazo actual/i] },
    { family: 'partoPuerperio', labels: [/monitorizaci/i] },
    { family: 'atencionPostnatal', labels: [/control de puerperio/i] },
  ])('only lists forms covered by the $family read and edit privileges', ({ family, labels }) => {
    const privileges = ['app:hoja.clinica', `app:hoja.clinica.${family}`, `app:hoja.clinica.${family}.editar`];
    mockUserHasAccess.mockImplementation((privilege) => privileges.includes(String(privilege)));

    render(<MaternalHealthFormsSelectorWorkspace {...defaultWorkspaceProps} />);

    expect(screen.getByText(`forms:${labels.length}`)).toBeInTheDocument();
    expect(screen.getAllByRole('button')).toHaveLength(labels.length);
    for (const label of labels) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    }
  });

  it.each([
    { privileges: [] },
    { privileges: ['app:hoja.clinica', 'app:hoja.clinica.partoPuerperio'] },
    { privileges: ['app:hoja.clinica', 'app:hoja.clinica.partoPuerperio.editar'] },
    { privileges: ['app:hoja.clinica.partoPuerperio', 'app:hoja.clinica.partoPuerperio.editar'] },
    { privileges: ['app:hoja.clinica', 'app:hoja.clinica.controlPrenatal', 'app:hoja.clinica.partoPuerperio.editar'] },
  ])('does not mount the selector or read clinical data with incomplete access $privileges', ({ privileges }) => {
    mockUserHasAccess.mockImplementation((privilege) => privileges.includes(String(privilege)));

    render(<MaternalHealthFormsSelectorWorkspace {...defaultWorkspaceProps} patientUuid="synthetic-patient" />);

    expect(mockFormsSelectorWorkspace).not.toHaveBeenCalled();
    expect(useCurrentPregnancy).not.toHaveBeenCalled();
    expect(openmrsFetch).not.toHaveBeenCalled();
  });

  it('does not mount the selector for an unauthenticated session', () => {
    vi.mocked(useSession).mockReturnValue({ ...mockSession.data, authenticated: false });

    render(<MaternalHealthFormsSelectorWorkspace {...defaultWorkspaceProps} />);

    expect(mockFormsSelectorWorkspace).not.toHaveBeenCalled();
    expect(useCurrentPregnancy).not.toHaveBeenCalled();
  });

  it('passes configured maternal forms to the shared forms selector', () => {
    render(<MaternalHealthFormsSelectorWorkspace {...defaultWorkspaceProps} />);

    expect(screen.getByRole('heading', { name: /formularios de salud materna/i })).toBeInTheDocument();
    expect(screen.getByText(/seleccione el formulario de salud materna/i)).toBeInTheDocument();
    expect(screen.getByText('forms:4')).toBeInTheDocument();
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

    await waitFor(() => {
      expect(mockLaunchWorkspace2).toHaveBeenCalledWith(formEntryWorkspace, {
        form: expect.objectContaining(currentPregnancyForm),
        encounterUuid: 'encounter-uuid',
        handlePostResponse: expect.any(Function),
      });
    });
    const { handlePostResponse } = mockLaunchWorkspace2.mock.calls[0][1] as { handlePostResponse: () => void };
    await act(async () => handlePostResponse());
    expect(mockOnFormSubmitted).toHaveBeenCalledOnce();
  });

  it('resolves a configured name to its published form UUID before launching', async () => {
    const user = userEvent.setup();
    mockUseConfig.mockReturnValue({ formsList: { currentPregnancy: ` ${currentPregnancyForm.name} ` } });
    mockOpenmrsFetch.mockResolvedValueOnce({
      data: { results: [currentPregnancyForm] },
    } as Awaited<ReturnType<typeof openmrsFetch>>);
    render(<MaternalHealthFormsSelectorWorkspace {...defaultWorkspaceProps} />);

    await user.click(screen.getByRole('button', { name: /embarazo actual/i }));

    await waitFor(() => {
      expect(mockLaunchWorkspace2).toHaveBeenCalledWith(formEntryWorkspace, {
        form: expect.objectContaining(currentPregnancyForm),
        encounterUuid: 'encounter-uuid',
        handlePostResponse: expect.any(Function),
      });
    });
    expect(mockOpenmrsFetch).toHaveBeenCalledWith(expect.stringContaining(`q=${currentPregnancyForm.name}`));
  });

  it.each([
    { state: 'missing', results: [] },
    { state: 'unpublished', results: [{ ...currentPregnancyForm, published: false }] },
    { state: 'retired', results: [{ ...currentPregnancyForm, retired: true }] },
  ])('does not open a $state configured form', async ({ results }) => {
    const user = userEvent.setup();
    mockUseConfig.mockReturnValue({ formsList: { currentPregnancy: currentPregnancyForm.name } });
    mockOpenmrsFetch.mockResolvedValueOnce({ data: { results } } as Awaited<ReturnType<typeof openmrsFetch>>);
    render(<MaternalHealthFormsSelectorWorkspace {...defaultWorkspaceProps} />);

    await user.click(screen.getByRole('button', { name: /embarazo actual/i }));

    await waitFor(() => {
      expect(showSnackbar).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: 'error',
          title: 'Formulario materno no disponible',
        }),
      );
    });
    expect(mockLaunchWorkspace2).not.toHaveBeenCalled();
  });

  it('shows a safe error and allows retry after form lookup fails', async () => {
    const user = userEvent.setup();
    mockOpenmrsFetch.mockRejectedValueOnce(new Error('private backend detail'));
    render(<MaternalHealthFormsSelectorWorkspace {...defaultWorkspaceProps} />);

    await user.click(screen.getByRole('button', { name: /embarazo actual/i }));

    await waitFor(() => {
      expect(showSnackbar).toHaveBeenCalledWith({
        kind: 'error',
        title: 'Formulario materno no disponible',
        subtitle: 'Revise que el formulario esté publicado y que el UUID o nombre configurado sea exacto.',
      });
    });
    expect(mockLaunchWorkspace2).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: /embarazo actual/i }));

    await waitFor(() => expect(mockLaunchWorkspace2).toHaveBeenCalledOnce());
  });

  it('opens only once when clicked repeatedly while the lookup is pending', async () => {
    const user = userEvent.setup();
    let finishLookup!: (response: Awaited<ReturnType<typeof openmrsFetch>>) => void;
    mockOpenmrsFetch.mockReturnValueOnce(
      new Promise((resolve) => {
        finishLookup = resolve;
      }),
    );
    render(<MaternalHealthFormsSelectorWorkspace {...defaultWorkspaceProps} />);

    await user.dblClick(screen.getByRole('button', { name: /embarazo actual/i }));

    expect(mockOpenmrsFetch).toHaveBeenCalledOnce();
    expect(mockLaunchWorkspace2).not.toHaveBeenCalled();
    await act(async () => {
      finishLookup({ data: currentPregnancyForm } as Awaited<ReturnType<typeof openmrsFetch>>);
    });
    expect(mockLaunchWorkspace2).toHaveBeenCalledOnce();
  });

  it.each(['permission revocation', 'account change', 'patient change', 'workspace closure'])(
    'discards a pending lookup after %s',
    async (change) => {
      const user = userEvent.setup();
      let finishLookup!: (response: Awaited<ReturnType<typeof openmrsFetch>>) => void;
      mockOpenmrsFetch.mockReturnValueOnce(
        new Promise((resolve) => {
          finishLookup = resolve;
        }),
      );
      const { rerender, unmount } = render(<MaternalHealthFormsSelectorWorkspace {...defaultWorkspaceProps} />);

      await user.click(screen.getByRole('button', { name: /embarazo actual/i }));
      expect(mockOpenmrsFetch).toHaveBeenCalledOnce();
      if (change === 'permission revocation') {
        mockUserHasAccess.mockImplementation((privilege) => privilege !== 'app:hoja.clinica.controlPrenatal.editar');
      } else if (change === 'account change') {
        getSessionStore().setState({
          loaded: true,
          session: { ...mockSession.data, user: { ...mockSession.data.user, uuid: 'different-synthetic-user' } },
        });
      } else if (change === 'patient change') {
        mockOpenmrsFetch.mockResolvedValue({ data: { results: [] } } as Awaited<ReturnType<typeof openmrsFetch>>);
        rerender(
          <MaternalHealthFormsSelectorWorkspace
            {...defaultWorkspaceProps}
            patientUuid="different-synthetic-patient"
          />,
        );
      } else {
        unmount();
      }

      await act(async () => {
        finishLookup({ data: currentPregnancyForm } as Awaited<ReturnType<typeof openmrsFetch>>);
      });

      expect(mockLaunchWorkspace2).not.toHaveBeenCalled();
      expect(showSnackbar).not.toHaveBeenCalled();
    },
  );

  it('does not launch a form after its specific permission is revoked', async () => {
    const user = userEvent.setup();
    render(<MaternalHealthFormsSelectorWorkspace {...defaultWorkspaceProps} />);
    mockUserHasAccess.mockImplementation((privilege) => privilege !== 'app:hoja.clinica.partoPuerperio.editar');

    await user.click(screen.getByRole('button', { name: /monitorizaci/i }));

    expect(mockLaunchWorkspace2).not.toHaveBeenCalled();
  });

  it('does not launch a retained form after the authenticated account changes', async () => {
    const user = userEvent.setup();
    render(<MaternalHealthFormsSelectorWorkspace {...defaultWorkspaceProps} />);
    getSessionStore().setState({
      loaded: true,
      session: { ...mockSession.data, user: { ...mockSession.data.user, uuid: 'different-synthetic-user' } },
    });

    await user.click(screen.getByRole('button', { name: /embarazo actual/i }));

    expect(mockLaunchWorkspace2).not.toHaveBeenCalled();
  });
});
