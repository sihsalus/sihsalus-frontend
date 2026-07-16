import { getUserFacingErrorMessage, logError } from '@openmrs/esm-error-handling';
import { useLayoutType } from '@openmrs/esm-react-utils';
import { getCoreTranslation } from '@openmrs/esm-translations';
import { render, screen } from '@testing-library/react';
import { StrictMode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ErrorState } from '.';

vi.mock('@openmrs/esm-react-utils', () => ({
  useLayoutType: vi.fn(() => 'small-desktop'),
}));

vi.mock('@openmrs/esm-error-handling', () => ({
  getUserFacingErrorMessage: vi.fn((_error: unknown, fallback: string) => fallback),
  logError: vi.fn(),
}));

const mockUseLayoutType = vi.mocked(useLayoutType);
const mockGetCoreTranslation = vi.mocked(getCoreTranslation);
const mockGetUserFacingErrorMessage = vi.mocked(getUserFacingErrorMessage);
const mockLogError = vi.mocked(logError);
const safeErrorMessage = 'There was a problem displaying this information. Try reloading the page or contact support.';

describe('ErrorState', () => {
  beforeEach(() => {
    mockGetCoreTranslation.mockReturnValue(safeErrorMessage);
    mockGetUserFacingErrorMessage.mockImplementation((_error, fallback) => fallback);
  });

  it('renders a safe error message and logs the technical error once', () => {
    const testError = {
      message: 'Sensitive backend detail',
      response: {
        status: 500,
        statusText: 'Internal Server Error',
      },
    };
    render(<ErrorState headerTitle="appointments" error={testError} />);

    expect(screen.getByRole('heading', { name: /appointments/i })).toBeTruthy();
    expect(screen.getByText(safeErrorMessage)).toBeTruthy();
    expect(screen.queryByText(/Sensitive backend detail|Internal Server Error/i)).toBeNull();
    expect(mockGetUserFacingErrorMessage).toHaveBeenCalledWith(testError, safeErrorMessage, { log: false });
    expect(mockLogError).toHaveBeenCalledOnce();
    expect(mockLogError).toHaveBeenCalledWith(testError, 'Styleguide error state');
  });

  it('should render tablet layout when layout type is tablet', () => {
    mockUseLayoutType.mockReturnValue('tablet');

    render(<ErrorState headerTitle="test" error={{}} />);
    // eslint-disable-next-line testing-library/no-node-access
    expect(screen.getByRole('heading').parentElement?.getAttribute('class')).toContain('tabletHeader');
  });

  it('should render desktop layout when layout type is not tablet', () => {
    mockUseLayoutType.mockReturnValue('small-desktop');

    render(<ErrorState headerTitle="test" error={{}} />);
    // eslint-disable-next-line testing-library/no-node-access
    expect(screen.getByRole('heading').parentElement?.getAttribute('class')).toContain('desktopHeader');
  });

  it('does not log again when rerendered with the same error', () => {
    const error = new Error('Technical detail');
    const { rerender } = render(
      <StrictMode>
        <ErrorState headerTitle="test" error={error} />
      </StrictMode>,
    );

    rerender(
      <StrictMode>
        <ErrorState headerTitle="test" error={error} />
      </StrictMode>,
    );

    expect(mockLogError).toHaveBeenCalledOnce();
  });
});
