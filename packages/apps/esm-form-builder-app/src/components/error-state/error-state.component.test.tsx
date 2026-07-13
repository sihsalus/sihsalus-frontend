import { getUserFacingErrorMessage, logError } from '@openmrs/esm-framework';
import { render, screen } from '@testing-library/react';
import { StrictMode } from 'react';
import { vi } from 'vitest';
import ErrorState from './error-state.component';

vi.mock('@openmrs/esm-framework', () => ({
  getCoreTranslation: vi.fn(
    () => 'There was a problem displaying this information. Try reloading the page or contact support.',
  ),
  getUserFacingErrorMessage: vi.fn((_error: unknown, fallback: string) => fallback),
  logError: vi.fn(),
  useLayoutType: vi.fn(() => 'small-desktop'),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback: string) => fallback,
  }),
}));

const mockGetUserFacingErrorMessage = vi.mocked(getUserFacingErrorMessage);
const mockLogError = vi.mocked(logError);

describe('ErrorState', () => {
  it('renders a safe error message and logs the technical error once', () => {
    const error = new Error('Sensitive backend detail');

    render(<ErrorState error={error} />);

    expect(screen.getByRole('heading', { name: 'Forms' })).toBeInTheDocument();
    expect(
      screen.getByText('There was a problem displaying this information. Try reloading the page or contact support.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Sensitive backend detail')).not.toBeInTheDocument();
    expect(mockGetUserFacingErrorMessage).toHaveBeenCalledWith(
      error,
      'There was a problem displaying this information. Try reloading the page or contact support.',
      { log: false },
    );
    expect(mockLogError).toHaveBeenCalledOnce();
    expect(mockLogError).toHaveBeenCalledWith(error, 'Form Builder error state');
  });

  it('does not log again when rerendered with the same error', () => {
    const error = new Error('Technical detail');
    const { rerender } = render(
      <StrictMode>
        <ErrorState error={error} />
      </StrictMode>,
    );

    rerender(
      <StrictMode>
        <ErrorState error={error} />
      </StrictMode>,
    );

    expect(mockLogError).toHaveBeenCalledOnce();
  });
});
