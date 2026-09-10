import { showSnackbar, useSession } from '@openmrs/esm-framework';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mockSession } from 'test-utils/mocks/session.mock';

import ChangeLanguageModal from './change-language.modal';
import { updateSessionLocale, updateUserProperties } from './change-language.resource';

const mockUser = {
  ...mockSession.data.user,
  userProperties: {
    defaultLocale: 'fr',
  },
};

vi.mock('@openmrs/esm-framework', async () => ({
  ...(await vi.importActual('@openmrs/esm-framework')),
  __esModule: true,
  useSession: vi.fn(),
  useAbortController: vi.fn(() => new AbortController()),
}));

vi.mock('./change-language.resource', () => ({
  updateUserProperties: vi.fn(),
  updateSessionLocale: vi.fn(),
}));

const mockUseSession = vi.mocked(useSession);
const mockUpdateUserProperties = vi.mocked(updateUserProperties);
const mockUpdateSessionLocale = vi.mocked(updateSessionLocale);
const mockShowSnackbar = vi.mocked(showSnackbar);

describe(`Change Language Modal`, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateUserProperties.mockResolvedValue(undefined);
    mockUpdateSessionLocale.mockResolvedValue(undefined);
    mockUseSession.mockReturnValue({
      ...mockSession.data,
      authenticated: true,
      user: mockUser,
      allowedLocales: ['en', 'fr', 'it', 'pt'],
      locale: 'fr',
    });
  });

  it('should correctly displays all allowed locales', () => {
    render(<ChangeLanguageModal close={vi.fn()} />);

    expect(screen.getByRole('radio', { name: /english/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /français/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /italiano/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /português/i })).toBeInTheDocument();
  });

  it('should close the modal when the cancel button is clicked', async () => {
    const user = userEvent.setup();
    const mockClose = vi.fn();

    render(<ChangeLanguageModal close={mockClose} />);

    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(mockClose).toHaveBeenCalled();
  });

  it('should change user locale when the submit button is clicked', async () => {
    const user = userEvent.setup();

    render(<ChangeLanguageModal close={vi.fn()} />);

    expect(screen.getByRole('radio', { name: /français/i })).toBeChecked();

    await user.click(screen.getByRole('radio', { name: /english/i }));
    await user.click(screen.getByRole('button', { name: /change/i }));

    expect(mockUpdateUserProperties).toHaveBeenCalledWith(mockUser.uuid, { defaultLocale: 'en' }, expect.anything());
  });

  it('should show a loading indicator in the submit button while language change is in progress', async () => {
    const user = userEvent.setup();
    mockUpdateUserProperties.mockImplementation(() => new Promise(() => {}));

    render(<ChangeLanguageModal close={vi.fn()} />);

    await user.click(screen.getByRole('radio', { name: /english/i }));
    await user.click(screen.getByRole('button', { name: /change/i }));

    expect(screen.getByText(/changing language.../i)).toBeInTheDocument();
  });

  it('should display the "Save as my default language" checkbox checked by default', () => {
    render(<ChangeLanguageModal close={vi.fn()} />);

    const checkbox = screen.getByRole('checkbox', {
      name: /Save as my default language/i,
    });
    expect(checkbox).toBeChecked();
  });

  it('should call updateSessionLocale when checkbox is unchecked and user changes locale', async () => {
    const user = userEvent.setup();

    render(<ChangeLanguageModal close={vi.fn()} />);

    // Uncheck the checkbox to only update session locale
    const checkbox = screen.getByRole('checkbox', {
      name: /Save as my default language/i,
    });
    await user.click(checkbox);

    // Change locale
    await user.click(screen.getByRole('radio', { name: /english/i }));
    await user.click(screen.getByRole('button', { name: /change/i }));

    expect(mockUpdateSessionLocale).toHaveBeenCalledWith('en', expect.anything());
    expect(mockUpdateUserProperties).not.toHaveBeenCalled();
  });

  it('should disable submit button when selected locale is same as current locale', () => {
    render(<ChangeLanguageModal close={vi.fn()} />);

    const submitButton = screen.getByRole('button', { name: /change/i });
    expect(submitButton).toBeDisabled();
  });

  it('disables language changes when the session has no user', async () => {
    const user = userEvent.setup();
    mockUseSession.mockReturnValue({
      authenticated: false,
      sessionId: '',
      allowedLocales: ['en', 'fr'],
      locale: 'fr',
    });

    render(<ChangeLanguageModal close={vi.fn()} />);

    await user.click(screen.getByRole('radio', { name: /english/i }));
    const submitButton = screen.getByRole('button', { name: /change/i });
    expect(submitButton).toBeDisabled();
    await user.click(submitButton);

    expect(mockUpdateUserProperties).not.toHaveBeenCalled();
    expect(mockUpdateSessionLocale).not.toHaveBeenCalled();
    expect(screen.queryByText(/changing language\.\.\./i)).not.toBeInTheDocument();
  });

  it('disables a pending selection when the user loses their session', async () => {
    const user = userEvent.setup();
    const close = vi.fn();
    const { rerender } = render(<ChangeLanguageModal close={close} />);

    await user.click(screen.getByRole('radio', { name: /english/i }));
    expect(screen.getByRole('button', { name: /change/i })).toBeEnabled();

    mockUseSession.mockReturnValue({ authenticated: false, sessionId: '' });
    rerender(<ChangeLanguageModal close={close} />);

    const submitButton = screen.getByRole('button', { name: /change/i });
    expect(submitButton).toBeDisabled();
    await user.click(submitButton);
    expect(mockUpdateUserProperties).not.toHaveBeenCalled();
    expect(mockUpdateSessionLocale).not.toHaveBeenCalled();
  });

  it('disables changes when authentication expires but user details remain', async () => {
    const user = userEvent.setup();
    mockUseSession.mockReturnValue({
      ...mockSession.data,
      authenticated: false,
      user: mockUser,
      allowedLocales: ['en', 'fr'],
      locale: 'fr',
    });
    render(<ChangeLanguageModal close={vi.fn()} />);

    await user.click(screen.getByRole('radio', { name: /english/i }));
    const submitButton = screen.getByRole('button', { name: /change/i });
    expect(submitButton).toBeDisabled();
    await user.click(submitButton);

    expect(mockUpdateUserProperties).not.toHaveBeenCalled();
    expect(mockUpdateSessionLocale).not.toHaveBeenCalled();
  });

  it('disables a selected language that is no longer allowed and recovers when it returns', async () => {
    const user = userEvent.setup();
    const close = vi.fn();
    const { rerender } = render(<ChangeLanguageModal close={close} />);
    await user.click(screen.getByRole('radio', { name: /english/i }));

    mockUseSession.mockReturnValue({
      ...mockSession.data,
      user: mockUser,
      allowedLocales: ['fr'],
      locale: 'fr',
    });
    rerender(<ChangeLanguageModal close={close} />);
    const submitButton = screen.getByRole('button', { name: /change/i });
    expect(submitButton).toBeDisabled();
    await user.click(submitButton);
    expect(mockUpdateUserProperties).not.toHaveBeenCalled();
    expect(mockUpdateSessionLocale).not.toHaveBeenCalled();

    mockUseSession.mockReturnValue({
      ...mockSession.data,
      user: mockUser,
      allowedLocales: ['en', 'fr'],
      locale: 'fr',
    });
    rerender(<ChangeLanguageModal close={close} />);
    await user.click(screen.getByRole('button', { name: /change/i }));
    expect(mockUpdateUserProperties).toHaveBeenCalledWith(mockUser.uuid, { defaultLocale: 'en' }, expect.anything());
  });

  it('requires a selection when the session has no current locale', async () => {
    const user = userEvent.setup();
    mockUseSession.mockReturnValue({
      ...mockSession.data,
      user: mockUser,
      allowedLocales: ['en', 'fr'],
      locale: undefined,
    });
    render(<ChangeLanguageModal close={vi.fn()} />);

    const submitButton = screen.getByRole('button', { name: /change/i });
    expect(submitButton).toBeDisabled();
    await user.click(screen.getByRole('radio', { name: /english/i }));
    expect(submitButton).toBeEnabled();
    await user.click(submitButton);

    expect(mockUpdateUserProperties).toHaveBeenCalledWith(mockUser.uuid, { defaultLocale: 'en' }, expect.anything());
  });

  it('saves the locale when the user has no stored preferences', async () => {
    const user = userEvent.setup();
    mockUseSession.mockReturnValue({
      ...mockSession.data,
      user: { ...mockUser, userProperties: null },
      allowedLocales: ['en', 'fr'],
      locale: 'fr',
    });
    render(<ChangeLanguageModal close={vi.fn()} />);

    await user.click(screen.getByRole('radio', { name: /english/i }));
    await user.click(screen.getByRole('button', { name: /change/i }));

    expect(mockUpdateUserProperties).toHaveBeenCalledWith(mockUser.uuid, { defaultLocale: 'en' }, expect.anything());
  });

  it.each([true, false])('allows retry after a failed language change (save default: %s)', async (saveDefault) => {
    const user = userEvent.setup();
    const update = saveDefault ? mockUpdateUserProperties : mockUpdateSessionLocale;
    update.mockRejectedValueOnce(new Error('Synthetic backend failure'));
    render(<ChangeLanguageModal close={vi.fn()} />);

    if (!saveDefault) {
      await user.click(screen.getByRole('checkbox', { name: /save as my default language/i }));
    }
    await user.click(screen.getByRole('radio', { name: /english/i }));
    await user.click(screen.getByRole('button', { name: /change/i }));

    await waitFor(() => {
      expect(mockShowSnackbar).toHaveBeenCalledWith({
        kind: 'error',
        title: 'Could not change language',
        subtitle: 'The language could not be changed. Please try again.',
      });
    });
    const retryButton = screen.getByRole('button', { name: /change/i });
    expect(retryButton).toBeEnabled();
    expect(screen.queryByText(/changing language\.\.\./i)).not.toBeInTheDocument();

    await user.click(retryButton);
    expect(update).toHaveBeenCalledTimes(2);
  });
});
