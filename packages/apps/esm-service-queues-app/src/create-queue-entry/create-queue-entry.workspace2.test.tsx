import {
  showSnackbar,
  userHasAccess,
  usePatient,
  useSession,
  useVisit,
  type LoggedInUser,
  type Visit,
} from '@openmrs/esm-framework';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import routes from '../routes.json';
import CreateQueueEntryWorkspace2 from './create-queue-entry.workspace2';

const mocks = vi.hoisted(() => ({
  existingVisitForm: vi.fn(),
  queueOnlyForm: vi.fn(),
}));

vi.mock('./existing-visit-form/existing-visit-form.component', () => ({
  default: (props) => {
    mocks.existingVisitForm(props);
    return <div>Existing visit queue form</div>;
  },
}));

vi.mock('./queue-only-form/queue-only-form.component', () => ({
  default: (props) => {
    mocks.queueOnlyForm(props);
    return <div>Administrative queue form</div>;
  },
}));

const mockUsePatient = vi.mocked(usePatient);
const mockUseSession = vi.mocked(useSession);
const mockUseVisit = vi.mocked(useVisit);
const mockUserHasAccess = vi.mocked(userHasAccess);
const mockShowSnackbar = vi.mocked(showSnackbar);
const queueEntryPrivileges = routes.workspaces2.find(
  ({ name }) => name === 'queue-patient-search-add-to-queue-workspace',
)?.privileges;
const startVisitPrivileges = routes.workspaces2.find(
  ({ name }) => name === 'queue-patient-search-start-visit-workspace',
)?.privileges;

if (!Array.isArray(queueEntryPrivileges) || !Array.isArray(startVisitPrivileges)) {
  throw new Error('Queue entry workspace privileges are not configured');
}

function userWithPrivileges(privileges: string[]) {
  return {
    privileges: privileges.map((display) => ({ display })),
    roles: [],
  } as unknown as LoggedInUser;
}

function patientResult(birthDate = '1990-04-20') {
  return {
    patient: {
      id: 'patient-uuid',
      resourceType: 'Patient',
      birthDate,
      name: [{ text: 'Rosa Pérez' }],
    },
    patientUuid: 'patient-uuid',
    isLoading: false,
    error: null,
  } as ReturnType<typeof usePatient>;
}

function visitResult(activeVisit: Visit | null = null) {
  return {
    activeVisit,
    currentVisit: null,
    currentVisitIsRetrospective: false,
    error: null,
    isLoading: false,
    isValidating: false,
    mutate: vi.fn(),
  } as unknown as ReturnType<typeof useVisit>;
}

function renderWorkspace(
  options: {
    isLeafWorkspace?: boolean;
    launchChildWorkspace?: (...args: Array<unknown>) => Promise<boolean>;
    requiredVisitLocation?: { uuid: string; display: string } | undefined;
  } = {},
) {
  const requiredVisitLocation = Object.hasOwn(options, 'requiredVisitLocation')
    ? options.requiredVisitLocation
    : { uuid: 'location-uuid', display: 'UPSS Consulta Externa' };
  const launchChildWorkspace = vi.fn(options.launchChildWorkspace ?? (async () => true));
  const closeWorkspace = vi.fn().mockResolvedValue(undefined);
  const props = {
    closeWorkspace,
    groupProps: {},
    isLeafWorkspace: options.isLeafWorkspace ?? true,
    isRootWorkspace: false,
    launchChildWorkspace,
    showActionMenu: true,
    windowName: 'add-queue-entry',
    windowProps: {},
    workspaceName: 'queue-patient-search-add-to-queue-workspace',
    workspaceProps: {
      currentQueueLocationUuid: 'location-uuid',
      currentServiceQueueUuid: 'queue-uuid',
      patient: patientResult().patient,
      requiredVisitLocation,
      selectedPatientUuid: 'patient-uuid',
    },
  } as unknown as React.ComponentProps<typeof CreateQueueEntryWorkspace2>;

  return { ...render(<CreateQueueEntryWorkspace2 {...props} />), closeWorkspace, launchChildWorkspace, props };
}

describe('CreateQueueEntryWorkspace2 authorization preflight', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUsePatient.mockReturnValue(patientResult());
    mockUseVisit.mockReturnValue(visitResult());
    mockUseSession.mockReturnValue({ user: userWithPrivileges(queueEntryPrivileges) } as ReturnType<typeof useSession>);
    mockUserHasAccess.mockImplementation((privilege, user) => {
      const requiredPrivileges = Array.isArray(privilege) ? privilege : [privilege];
      const grantedPrivileges = new Set(user?.privileges?.map(({ display }) => display));
      return requiredPrivileges.every((requiredPrivilege) => grantedPrivileges.has(requiredPrivilege));
    });
  });

  it('reuses an active visit without Add Visits or Get Visit Types', () => {
    const activeVisit = {
      uuid: 'active-visit-uuid',
      patient: { uuid: 'patient-uuid' },
    } as Visit;
    mockUseVisit.mockReturnValue(visitResult(activeVisit));

    const { launchChildWorkspace } = renderWorkspace();

    expect(screen.getByText('Existing visit queue form')).toBeInTheDocument();
    expect(mocks.existingVisitForm).toHaveBeenCalledWith(expect.objectContaining({ visit: activeVisit }));
    expect(launchChildWorkspace).not.toHaveBeenCalled();
  });

  it('opens an administrative queue form without Add Visits or Get Visit Types', () => {
    const { launchChildWorkspace } = renderWorkspace({ requiredVisitLocation: undefined });

    expect(screen.getByText('Administrative queue form')).toBeInTheDocument();
    expect(mocks.queueOnlyForm).toHaveBeenCalledWith(expect.objectContaining({ patientUuid: 'patient-uuid' }));
    expect(launchChildWorkspace).not.toHaveBeenCalled();
  });

  it('explains why a new visit cannot start when visit creation privileges are missing', () => {
    const { launchChildWorkspace } = renderWorkspace();

    expect(screen.getByText(/no puede iniciar una consulta desde esta cola/i)).toBeInTheDocument();
    expect(launchChildWorkspace).not.toHaveBeenCalled();
  });

  it('blocks a minor before opening the visit when neither companion path is available', () => {
    mockUseSession.mockReturnValue({ user: userWithPrivileges(startVisitPrivileges) } as ReturnType<typeof useSession>);
    mockUsePatient.mockReturnValue(patientResult('2016-08-11'));

    const { launchChildWorkspace } = renderWorkspace();

    expect(screen.getByText(/se requiere acceso a acompañantes/i)).toBeInTheDocument();
    expect(launchChildWorkspace).not.toHaveBeenCalled();
  });

  it('fails closed with visible feedback while age is loading or unavailable', () => {
    mockUseSession.mockReturnValue({ user: userWithPrivileges(startVisitPrivileges) } as ReturnType<typeof useSession>);
    mockUsePatient.mockReturnValue({
      ...patientResult(),
      patient: undefined,
      isLoading: true,
    } as ReturnType<typeof usePatient>);
    const firstRender = renderWorkspace();

    expect(screen.getByText(/verificando la edad del paciente/i)).toBeInTheDocument();
    expect(firstRender.launchChildWorkspace).not.toHaveBeenCalled();

    firstRender.unmount();
    mockUsePatient.mockReturnValue({
      ...patientResult(),
      patient: undefined,
      error: new Error('Patient request failed'),
    } as ReturnType<typeof usePatient>);
    const secondRender = renderWorkspace();

    expect(screen.getByText(/no se pudo verificar la edad del paciente/i)).toBeInTheDocument();
    expect(secondRender.launchChildWorkspace).not.toHaveBeenCalled();
  });

  it('launches the protected start-visit child for an adult with its complete privilege set', async () => {
    mockUseSession.mockReturnValue({ user: userWithPrivileges(startVisitPrivileges) } as ReturnType<typeof useSession>);

    const { launchChildWorkspace } = renderWorkspace();

    await waitFor(() =>
      expect(launchChildWorkspace).toHaveBeenCalledWith(
        'queue-patient-search-start-visit-workspace',
        expect.objectContaining({ patientUuid: 'patient-uuid' }),
      ),
    );
  });

  it('shows a retry instead of leaving a permanent skeleton when the child workspace is not opened', async () => {
    mockUseSession.mockReturnValue({ user: userWithPrivileges(startVisitPrivileges) } as ReturnType<typeof useSession>);
    let attempts = 0;
    const { launchChildWorkspace } = renderWorkspace({
      launchChildWorkspace: async () => {
        attempts += 1;
        return attempts > 1;
      },
    });

    const retryButton = await screen.findByRole('button', { name: /retry|reintentar/i });
    expect(launchChildWorkspace).toHaveBeenCalledOnce();
    expect(screen.getByRole('alert')).toHaveTextContent(/visit start could not be completed|no se pudo completar/i);

    await userEvent.click(retryButton);

    await waitFor(() => expect(launchChildWorkspace).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByRole('button', { name: /retry|reintentar/i })).not.toBeInTheDocument());
  });

  it('retries under the idempotency token of the first attempt', async () => {
    // The visit form mints a token per mount, and retrying remounts it. Without a
    // token owned here, a first attempt that persisted the visit but failed to
    // enqueue the patient would be retried as a brand new visit.
    mockUseSession.mockReturnValue({ user: userWithPrivileges(startVisitPrivileges) } as ReturnType<typeof useSession>);
    let attempts = 0;
    const { launchChildWorkspace } = renderWorkspace({
      launchChildWorkspace: async () => {
        attempts += 1;
        return attempts > 1;
      },
    });

    await userEvent.click(await screen.findByRole('button', { name: /retry|reintentar/i }));
    await waitFor(() => expect(launchChildWorkspace).toHaveBeenCalledTimes(2));

    const tokenOf = (call: number) =>
      (launchChildWorkspace.mock.calls[call][1] as { visitPersistenceToken?: string }).visitPersistenceToken;
    expect(tokenOf(0)).toEqual(expect.any(String));
    expect(tokenOf(1)).toBe(tokenOf(0));
  });

  it('recovers visibly when launching the child workspace rejects', async () => {
    mockUseSession.mockReturnValue({ user: userWithPrivileges(startVisitPrivileges) } as ReturnType<typeof useSession>);
    let attempts = 0;
    const { launchChildWorkspace } = renderWorkspace({
      launchChildWorkspace: async () => {
        attempts += 1;
        if (attempts === 1) {
          throw new Error('Workspace loader failed');
        }
        return true;
      },
    });

    const retryButton = await screen.findByRole('button', { name: /retry|reintentar/i });
    expect(mockShowSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'error',
        title: 'No se pudo agregar el paciente a la cola',
      }),
    );

    await userEvent.click(retryButton);

    await waitFor(() => expect(launchChildWorkspace).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByRole('button', { name: /retry|reintentar/i })).not.toBeInTheDocument());
  });

  it('offers recovery when the opened child is closed before the queue entry is completed', async () => {
    mockUseSession.mockReturnValue({ user: userWithPrivileges(startVisitPrivileges) } as ReturnType<typeof useSession>);
    const rendered = renderWorkspace();

    await waitFor(() => expect(rendered.launchChildWorkspace).toHaveBeenCalledOnce());
    expect(screen.getByRole('progressbar')).toBeInTheDocument();

    rendered.rerender(<CreateQueueEntryWorkspace2 {...rendered.props} isLeafWorkspace={false} />);
    rendered.rerender(<CreateQueueEntryWorkspace2 {...rendered.props} isLeafWorkspace />);

    const retryButton = await screen.findByRole('button', { name: /retry|reintentar/i });
    expect(screen.getByRole('alert')).toHaveTextContent(/visit start could not be completed|no se pudo completar/i);

    await userEvent.click(retryButton);

    await waitFor(() => expect(rendered.launchChildWorkspace).toHaveBeenCalledTimes(2));
  });

  it.each([
    ['search', ['Get People']],
    ['registration', ['app:opciones.registrarAcompanante', 'Add People']],
  ])('launches a minor visit through the %s companion capability', async (_description, companionPrivileges) => {
    mockUseSession.mockReturnValue({
      user: userWithPrivileges([...startVisitPrivileges, ...companionPrivileges]),
    } as ReturnType<typeof useSession>);
    mockUsePatient.mockReturnValue(patientResult('2016-08-11'));

    const { launchChildWorkspace } = renderWorkspace();

    await waitFor(() => expect(launchChildWorkspace).toHaveBeenCalledOnce());
  });
});
