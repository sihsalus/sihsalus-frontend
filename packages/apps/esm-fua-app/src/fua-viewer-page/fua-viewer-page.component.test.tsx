// @vitest-environment jsdom

import { showSnackbar, useConfig } from '@openmrs/esm-framework';
import { render, screen, waitFor } from '@testing-library/react';

import type { Config } from '../config-schema';
import FuaViewerPage from './fua-viewer-page.component';

vi.mock('@openmrs/esm-framework', () => ({
  showSnackbar: vi.fn(),
  useConfig: vi.fn(),
}));

vi.mock('@sihsalus/esm-rbac', () => ({
  RequirePrivilege: ({ children }) => children,
}));

const mockFetch = vi.fn();
const mockShowSnackbar = vi.mocked(showSnackbar);
const mockUseConfig = vi.mocked(useConfig<Config>);

describe('FuaViewerPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', mockFetch);
    mockUseConfig.mockReturnValue({ fuaGeneratorEndpoint: '/secure/fua-generator' } as Config);
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  it('does not expose HTTP status text or backend details', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 503,
      statusText: 'SQLSTATE 57P01 internal endpoint /ws/rest/v1/fua',
    });

    render(<FuaViewerPage />);

    expect(await screen.findAllByText('Error loading FUA viewer')).toHaveLength(2);
    await waitFor(() =>
      expect(mockShowSnackbar).toHaveBeenCalledWith(
        expect.objectContaining({ kind: 'error', subtitle: 'Error loading FUA viewer' }),
      ),
    );
    expect(screen.queryByText(/SQLSTATE|\/ws\/rest|503/u)).not.toBeInTheDocument();
    expect(mockShowSnackbar.mock.calls.flatMap(([message]) => message.subtitle ?? []).join(' ')).not.toMatch(
      /SQLSTATE|\/ws\/rest|503/u,
    );
  });
});
