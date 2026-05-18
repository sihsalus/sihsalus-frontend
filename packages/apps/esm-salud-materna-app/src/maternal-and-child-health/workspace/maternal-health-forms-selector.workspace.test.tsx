import { launchWorkspace2, useConfig } from '@openmrs/esm-framework';
import { FormsSelectorWorkspace } from '@sihsalus/esm-sihsalus-shared';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { formEntryWorkspace } from '../../types';
import MaternalHealthFormsSelectorWorkspace from './maternal-health-forms-selector.workspace';

const mockLaunchWorkspace2 = vi.mocked(launchWorkspace2);
const mockUseConfig = useConfig as vi.Mock;
const mockFormsSelectorWorkspace = vi.mocked(FormsSelectorWorkspace);

vi.mock('@sihsalus/esm-sihsalus-shared', async () => {
  const originalModule = await vi.importActual('@sihsalus/esm-sihsalus-shared');

  return {
    ...originalModule,
    FormsSelectorWorkspace: vi.fn(({ availableForms, backWorkspace, onFormLaunch, subtitle, title }) => (
      <div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
        <span>backWorkspace:{String(backWorkspace)}</span>
        <span>forms:{availableForms.length}</span>
        {availableForms.map(({ form }) => (
          <button key={form.uuid} type="button" onClick={() => onFormLaunch(form, 'encounter-uuid')}>
            {form.display}
          </button>
        ))}
      </div>
    )),
  };
});

describe('MaternalHealthFormsSelectorWorkspace', () => {
  beforeEach(() => {
    mockUseConfig.mockReturnValue({
      formsList: {
        maternalHistory: 'maternal-history-form-uuid',
        currentPregnancy: 'current-pregnancy-form-uuid',
        birthPlanForm: '',
      },
    });
  });

  it('passes configured maternal forms to the shared forms selector', () => {
    render(<MaternalHealthFormsSelectorWorkspace {...({} as any)} />);

    expect(screen.getByRole('heading', { name: /formularios de salud materna/i })).toBeInTheDocument();
    expect(screen.getByText(/seleccione el formulario de salud materna/i)).toBeInTheDocument();
    expect(screen.getByText('forms:2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /antecedentes obstétricos/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /embarazo actual/i })).toBeInTheDocument();
    expect(screen.getByText('backWorkspace:null')).toBeInTheDocument();
    expect(mockFormsSelectorWorkspace).toHaveBeenCalledWith(
      expect.objectContaining({
        patientAge: '',
        controlNumber: 0,
        backWorkspace: null,
      }),
      undefined,
    );
  });

  it('launches form entry with the selected form uuid and encounter', async () => {
    const user = userEvent.setup();

    render(<MaternalHealthFormsSelectorWorkspace {...({} as any)} />);

    await user.click(screen.getByRole('button', { name: /embarazo actual/i }));

    expect(mockLaunchWorkspace2).toHaveBeenCalledWith(formEntryWorkspace, {
      form: { uuid: 'current-pregnancy-form-uuid' },
      encounterUuid: 'encounter-uuid',
    });
  });
});
