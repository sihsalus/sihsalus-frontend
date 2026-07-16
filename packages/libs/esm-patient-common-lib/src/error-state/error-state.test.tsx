import { getUserFacingErrorMessage, logError } from '@openmrs/esm-framework';
import { render, screen } from '@testing-library/react';
import { StrictMode } from 'react';
import { vi } from 'vitest';

import { ErrorState } from '.';

vi.mock('@openmrs/esm-framework', () => ({
  getCoreTranslation: vi.fn(
    () => 'There was a problem displaying this information. Try reloading the page or contact support.',
  ),
  getUserFacingErrorMessage: vi.fn((_error: unknown, fallback: string) => fallback),
  logError: vi.fn(),
  useLayoutType: vi.fn(() => 'small-desktop'),
}));

const mockGetUserFacingErrorMessage = vi.mocked(getUserFacingErrorMessage);
const mockLogError = vi.mocked(logError);

describe('ErrorState', () => {
  it('renders a safe error message and logs the technical error once', () => {
    const testError = {
      message: 'Sensitive backend detail',
      response: {
        status: 500,
        statusText: 'Internal Server Error',
      },
    };
    render(<ErrorState headerTitle="appointments" error={testError} />);

    expect(screen.getByRole('heading', { name: /appointments/i })).toBeInTheDocument();
    expect(
      screen.getByText('There was a problem displaying this information. Try reloading the page or contact support.'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Sensitive backend detail|Internal Server Error/i)).not.toBeInTheDocument();
    expect(mockGetUserFacingErrorMessage).toHaveBeenCalledWith(
      testError,
      'There was a problem displaying this information. Try reloading the page or contact support.',
      { log: false },
    );
    expect(mockLogError).toHaveBeenCalledOnce();
    expect(mockLogError).toHaveBeenCalledWith(testError, 'Patient error state');
  });

  it('does not log again when rerendered with the same error', () => {
    const error = new Error('Technical detail');
    const { rerender } = render(
      <StrictMode>
        <ErrorState headerTitle="appointments" error={error} />
      </StrictMode>,
    );

    rerender(
      <StrictMode>
        <ErrorState headerTitle="appointments" error={error} />
      </StrictMode>,
    );

    expect(mockLogError).toHaveBeenCalledOnce();
  });
});
