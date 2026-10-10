import { launchWorkspace, launchWorkspace2 } from '@openmrs/esm-framework';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { FormsListProps } from './forms-list.component';
import FormsSelectorWorkspace, { type FormLaunchHandler } from './forms-selector.workspace';
import type { CompletedFormInfo } from './types';

vi.mock('@openmrs/esm-framework', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@openmrs/esm-framework')>()),
  launchWorkspace: vi.fn(),
  launchWorkspace2: vi.fn().mockResolvedValue(true),
  useLayoutType: () => 'desktop',
  Workspace2: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

let submitOpenedForm: (() => void) | undefined;

vi.mock('./forms-list.component', () => ({
  default: ({ completedForms = [], handleFormOpen }: FormsListProps) => {
    const firstForm = completedForms[0]?.form;
    return (
      <button type="button" disabled={!firstForm} onClick={() => firstForm && handleFormOpen(firstForm, '')}>
        Abrir formulario
      </button>
    );
  },
}));

const availableForms: CompletedFormInfo[] = [
  {
    form: {
      uuid: 'form-uuid',
      name: 'Formulario CRED',
      version: '1',
      published: true,
      retired: false,
      resources: [],
    },
    associatedEncounters: [],
  },
];

describe('FormsSelectorWorkspace', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    submitOpenedForm = undefined;
  });

  it.each(['Volver', 'Cancelar'])(
    'returns through Workspace2 after %s without opening a legacy panel',
    async (action) => {
      const user = userEvent.setup();
      const closeWorkspace = vi.fn();
      render(
        <FormsSelectorWorkspace
          availableForms={availableForms}
          patientAge="18 meses"
          controlNumber={1}
          patientUuid="synthetic-child"
          backWorkspace="wellchild-control-form"
          onFormLaunch={vi.fn()}
          closeWorkspace={closeWorkspace}
          closeWorkspaceWithSavedChanges={vi.fn()}
          promptBeforeClosing={vi.fn()}
          setTitle={vi.fn()}
        />,
      );

      await user.click(screen.getByRole('button', { name: action }));
      expect(closeWorkspace).toHaveBeenCalledOnce();
      expect(launchWorkspace2).not.toHaveBeenCalled();
      expect(launchWorkspace).not.toHaveBeenCalled();
      const options = closeWorkspace.mock.calls[0][0];
      expect(options.closeWorkspaceGroup).toBe(false);
      act(() => options.onWorkspaceClose());
      expect(launchWorkspace2).toHaveBeenCalledExactlyOnceWith('wellchild-control-form', {
        patientUuid: 'synthetic-child',
      });
      expect(launchWorkspace).not.toHaveBeenCalled();
    },
  );

  it('marks a form as completed only after its submit callback runs', async () => {
    const user = userEvent.setup();
    const onFormLaunch = vi.fn<FormLaunchHandler>((_form, _encounterUuid, onFormSubmitted) => {
      submitOpenedForm = onFormSubmitted;
    });

    const onComplete = vi.fn();
    const closeWorkspaceWithSavedChanges = vi.fn();
    render(
      <FormsSelectorWorkspace
        availableForms={availableForms}
        patientAge="6 meses"
        controlNumber={8}
        patientUuid="patient-uuid"
        onFormLaunch={onFormLaunch}
        closeWorkspace={vi.fn()}
        onComplete={onComplete}
        closeWorkspaceWithSavedChanges={closeWorkspaceWithSavedChanges}
        promptBeforeClosing={vi.fn()}
        setTitle={vi.fn()}
      />,
    );

    const finishButton = screen.getByRole('button', {
      name: /cerrar formularios/i,
    });
    expect(finishButton).toBeDisabled();

    await user.click(screen.getByRole('button', { name: /abrir formulario/i }));

    expect(onFormLaunch).toHaveBeenCalledOnce();
    expect(finishButton).toBeDisabled();
    expect(screen.queryByText(/formularios completados/i)).not.toBeInTheDocument();

    act(() => submitOpenedForm?.());

    expect(finishButton).toBeEnabled();
    expect(screen.getByText(/formularios completados/i)).toHaveTextContent('1');
    await user.click(finishButton);
    expect(onComplete).toHaveBeenCalledOnce();
    expect(closeWorkspaceWithSavedChanges).toHaveBeenCalledOnce();
    expect(onFormLaunch).toHaveBeenCalledOnce();
  });
});
