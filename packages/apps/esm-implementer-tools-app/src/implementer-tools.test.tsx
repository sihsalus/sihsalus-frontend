import { showToast } from '@openmrs/esm-framework';
import { render, waitFor } from '@testing-library/react';

import Root from './implementer-tools.component';

const mockUseBackendDependencies = vi.hoisted(() => vi.fn());

vi.mock('./backend-dependencies/useBackendDependencies', () => ({
  useBackendDependencies: mockUseBackendDependencies,
}));

describe('ImplementerTools', () => {
  beforeEach(() => {
    mockUseBackendDependencies.mockReturnValue({
      modules: [],
      error: null,
      errorStatus: null,
      isRetrying: false,
      retry: vi.fn(),
    });
  });

  it('renders without dying', () => {
    render(<Root />);
  });

  it('keeps background connection failures inside implementer diagnostics', () => {
    mockUseBackendDependencies.mockReturnValue({
      modules: [],
      error: 'Failed to fetch backend modules: Server responded with 503',
      errorStatus: 503,
      isRetrying: false,
      retry: vi.fn(),
    });

    render(<Root />);

    expect(showToast).not.toHaveBeenCalled();
  });

  it('still warns implementers after a successful check finds an unresolved dependency', async () => {
    mockUseBackendDependencies.mockReturnValue({
      modules: [
        {
          name: '@openmrs/esm-example-app',
          dependencies: [
            {
              name: 'example-module',
              requiredVersion: '^1.0.0',
              type: 'missing',
            },
          ],
        },
      ],
      error: null,
      errorStatus: null,
      isRetrying: false,
      retry: vi.fn(),
    });

    render(<Root />);

    await waitFor(() =>
      expect(showToast).toHaveBeenCalledWith(
        expect.objectContaining({
          actionButtonLabel: 'View modules',
          title: 'Some modules have unresolved backend dependencies',
        }),
      ),
    );
  });
});
