import { type FetchResponse, getUserFacingErrorMessage } from '@openmrs/esm-framework';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import ChangePasswordModal from './change-password.modal';
import { changeUserPassword } from './change-password.resource';

const mockClose = vi.fn();
const mockChangeUserPassword = vi.mocked(changeUserPassword);
const mockGetUserFacingErrorMessage = vi.mocked(getUserFacingErrorMessage);

vi.mock('react-i18next', () => {
  const translations: Record<string, string> = {
    cancel: 'Cancelar',
    change: 'Cambiar',
    changePassword: 'Cambiar contraseña',
    close: 'Cerrar',
    confirmPassword: 'Confirmar nueva contraseña',
    errorChangingPassword: 'Error al cambiar la contraseña',
    hidePassword: 'Ocultar contraseña',
    newPassword: 'Nueva contraseña',
    newPasswordRequired: 'Ingresa una nueva contraseña',
    oldPassword: 'Contraseña anterior',
    oldPasswordIncorrect: 'La contraseña anterior es incorrecta',
    oldPasswordRequired: 'Ingresa tu contraseña actual',
    passwordChangeFailed: 'No se pudo cambiar la contraseña. Inténtalo de nuevo',
    passwordConfirmationRequired: 'Confirma la nueva contraseña',
    passwordRequirements: 'Usa al menos 8 caracteres, con una letra mayúscula, una letra minúscula y un dígito',
    passwordsDoNotMatch: 'Las contraseñas no coinciden',
    showPassword: 'Mostrar contraseña',
  };

  return {
    useTranslation: () => ({
      t: (key: string, defaultValue: string) => translations[key] ?? defaultValue,
    }),
  };
});

vi.mock('./change-password.resource', () => ({
  changeUserPassword: vi.fn().mockResolvedValue({}),
}));

describe('ChangePasswordModal', () => {
  beforeEach(() => {
    mockChangeUserPassword.mockResolvedValue({} as FetchResponse<unknown>);
    mockGetUserFacingErrorMessage.mockImplementation((error, fallback, options) => {
      const code = (error as { code?: string })?.code;
      return (code && options?.codeMessages?.[code]) || fallback;
    });
  });

  it('shows the password requirements and localized control labels', async () => {
    const user = userEvent.setup();

    render(<ChangePasswordModal close={mockClose} />);

    expect(screen.getByRole('heading', { name: 'Cambiar contraseña' })).toBeInTheDocument();
    expect(
      screen.getByText('Usa al menos 8 caracteres, con una letra mayúscula, una letra minúscula y un dígito'),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Mostrar contraseña' })).toHaveLength(3);
    expect(screen.getByRole('button', { name: 'Cerrar' })).toBeInTheDocument();

    await user.click(screen.getAllByRole('button', { name: 'Mostrar contraseña' })[0]);

    expect(screen.getByRole('button', { name: 'Ocultar contraseña' })).toBeInTheDocument();
  });

  it('skips password visibility controls when navigating with Tab', async () => {
    const user = userEvent.setup();

    render(<ChangePasswordModal close={mockClose} />);

    const oldPasswordInput = screen.getByLabelText('Contraseña anterior');
    const newPasswordInput = screen.getByLabelText('Nueva contraseña');
    const passwordConfirmationInput = screen.getByLabelText('Confirmar nueva contraseña');

    oldPasswordInput.focus();
    await user.tab();
    expect(newPasswordInput).toHaveFocus();

    await user.tab();
    expect(passwordConfirmationInput).toHaveFocus();

    screen.getAllByRole('button', { name: 'Mostrar contraseña' }).forEach((visibilityToggle) => {
      expect(visibilityToggle).toHaveAttribute('tabindex', '-1');
    });
  });

  it('validates empty fields as soon as they are touched', async () => {
    const user = userEvent.setup();

    render(<ChangePasswordModal close={mockClose} />);

    await user.click(screen.getByLabelText('Contraseña anterior'));
    await user.tab();
    expect(await screen.findByText('Ingresa tu contraseña actual')).toBeInTheDocument();

    await user.click(screen.getByLabelText('Nueva contraseña'));
    await user.tab();
    expect(await screen.findByText('Ingresa una nueva contraseña')).toBeInTheDocument();

    await user.click(screen.getByLabelText('Confirmar nueva contraseña'));
    await user.tab();
    expect(await screen.findByText('Confirma la nueva contraseña')).toBeInTheDocument();
    expect(mockChangeUserPassword).not.toHaveBeenCalled();
  });

  it('warns about an invalid password format before submission', async () => {
    const user = userEvent.setup();

    render(<ChangePasswordModal close={mockClose} />);

    const newPasswordInput = screen.getByLabelText('Nueva contraseña');
    await user.type(newPasswordInput, 'Password');

    await waitFor(() => expect(newPasswordInput).toHaveAttribute('aria-invalid', 'true'));
    expect(mockChangeUserPassword).not.toHaveBeenCalled();

    await user.type(newPasswordInput, '1');

    await waitFor(() => expect(newPasswordInput).not.toHaveAttribute('aria-invalid', 'true'));
  });

  it('checks password confirmation before submitting a valid form', async () => {
    const user = userEvent.setup();

    render(<ChangePasswordModal close={mockClose} />);

    await user.type(screen.getByLabelText('Contraseña anterior'), 'P@ssw0rd123!');
    await user.type(screen.getByLabelText('Nueva contraseña'), 'N3wPassword');
    await user.type(screen.getByLabelText('Confirmar nueva contraseña'), 'N3wPasswor4');

    expect(await screen.findByText('Las contraseñas no coinciden')).toBeInTheDocument();
    expect(mockChangeUserPassword).not.toHaveBeenCalled();

    await user.clear(screen.getByLabelText('Confirmar nueva contraseña'));
    await user.type(screen.getByLabelText('Confirmar nueva contraseña'), 'N3wPassword');
    await user.click(screen.getByRole('button', { name: 'Cambiar' }));

    await waitFor(() => {
      expect(mockChangeUserPassword).toHaveBeenCalledTimes(1);
      expect(mockChangeUserPassword).toHaveBeenCalledWith('P@ssw0rd123!', 'N3wPassword');
    });
  });

  it('translates the backend error for an incorrect current password', async () => {
    const user = userEvent.setup();
    mockChangeUserPassword.mockRejectedValueOnce({
      responseBody: {
        error: {
          message: 'Old password is not correct.',
        },
      },
    });

    render(<ChangePasswordModal close={mockClose} />);

    await user.type(screen.getByLabelText('Contraseña anterior'), 'Wr0ngPassword');
    await user.type(screen.getByLabelText('Nueva contraseña'), 'N3wPassword');
    await user.type(screen.getByLabelText('Confirmar nueva contraseña'), 'N3wPassword');
    await user.click(screen.getByRole('button', { name: 'Cambiar' }));

    expect(await screen.findByText('La contraseña anterior es incorrecta')).toBeInTheDocument();
    expect(screen.queryByText('Old password is not correct.')).not.toBeInTheDocument();
  });
});
