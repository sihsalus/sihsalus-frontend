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
          kind: 'error',
          title: 'Some modules have unresolved backend dependencies',
        }),
      ),
    );
  });

  it('reports a version mismatch as a warning without naming the empty category', async () => {
    mockUseBackendDependencies.mockReturnValue({
      modules: [
        {
          name: '@sihsalus/esm-patient-attachments-app',
          dependencies: [
            {
              name: 'attachments',
              requiredVersion: '>=4.0.1-sihsalus.1 <5.0.0',
              installedVersion: '4.0.0',
              type: 'version-mismatch',
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

    await waitFor(() => expect(showToast).toHaveBeenCalled());

    const [{ description, kind, title }] = vi.mocked(showToast).mock.calls[0];

    expect(kind).toBe('warning');
    expect(title).toBe('Some modules need a different backend version');
    expect(description).toContain('1 backend module has an incompatible version.');
    // The regression: a summary that opened with "0 backend module(s) are
    // missing" buried the single finding that mattered.
    expect(description).not.toContain('0 backend module');
    expect(description).toContain('attachments 4.0.0 -> >=4.0.1-sihsalus.1 <5.0.0');
  });
});
