import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { FormsListProps } from './forms-list.component';
import FormsSelectorWorkspace, { type FormLaunchHandler } from './forms-selector.workspace';
import type { CompletedFormInfo } from './types';

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
    submitOpenedForm = undefined;
  });

  it('marks a form as completed only after its submit callback runs', async () => {
    const user = userEvent.setup();
    const onFormLaunch = vi.fn<FormLaunchHandler>((_form, _encounterUuid, onFormSubmitted) => {
      submitOpenedForm = onFormSubmitted;
    });

    render(
      <FormsSelectorWorkspace
        availableForms={availableForms}
        patientAge="6 meses"
        controlNumber={8}
        patientUuid="patient-uuid"
        onFormLaunch={onFormLaunch}
        closeWorkspace={vi.fn()}
        closeWorkspaceWithSavedChanges={vi.fn()}
        promptBeforeClosing={vi.fn()}
        setTitle={vi.fn()}
      />,
    );

    const finishButton = screen.getByRole('button', {
      name: /guardar y firmar/i,
    });
    expect(finishButton).toBeDisabled();

    await user.click(screen.getByRole('button', { name: /abrir formulario/i }));

    expect(onFormLaunch).toHaveBeenCalledOnce();
    expect(finishButton).toBeDisabled();
    expect(screen.queryByText(/formularios completados/i)).not.toBeInTheDocument();

    act(() => submitOpenedForm?.());

    expect(finishButton).toBeEnabled();
    expect(screen.getByText(/formularios completados/i)).toHaveTextContent('1');
  });
});
