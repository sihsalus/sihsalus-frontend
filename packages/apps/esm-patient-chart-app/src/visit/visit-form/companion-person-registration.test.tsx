import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import CompanionPersonRegistrationWorkspace from './companion-person-registration.workspace';

vi.mock('@openmrs/esm-framework', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@openmrs/esm-framework')>();

  return {
    ...actual,
    Workspace2: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});

describe('CompanionPersonRegistrationWorkspace', () => {
  const defaultProps = {
    closeWorkspace: vi.fn(),
    groupProps: null,
    isRootWorkspace: true,
    launchChildWorkspace: vi.fn(),
    showActionMenu: false,
    windowName: 'companion-window',
    windowProps: null,
    workspaceName: 'companion-person-registration',
    workspaceProps: {
      onCompanionSelected: vi.fn(),
      patientUuid: 'patient-uuid',
      requireAdult: false,
    },
  };

  it('uses only the controlled inline validation for an invalid approximate age', async () => {
    const user = userEvent.setup();

    render(<CompanionPersonRegistrationWorkspace {...defaultProps} />);

    const ageInput = screen.getByRole('spinbutton', { name: /edad aproximada|approximate age/i });
    const form = ageInput.closest('form');

    expect(form).toHaveAttribute('novalidate');
    expect(ageInput).toHaveAttribute('max', '140');

    await user.type(ageInput, '150');
    await user.click(screen.getByRole('button', { name: /guardar y regresar|save and return/i }));

    expect(
      await screen.findByText(
        /la edad aproximada debe ser un número entre 0 y 140|approximate age must be a number between 0 and 140/i,
      ),
    ).toBeInTheDocument();
  });
});
