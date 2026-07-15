// @vitest-environment jsdom

import { showSnackbar, useConfig } from '@openmrs/esm-framework';
import { render, screen, waitFor } from '@testing-library/react';

import type { Config } from '../config-schema';
import FuaHtmlViewer from './fua-html-viewer.component';

vi.mock('@openmrs/esm-framework', () => ({
  showSnackbar: vi.fn(),
  useConfig: vi.fn(),
}));

const mockShowSnackbar = vi.mocked(showSnackbar);
const mockUseConfig = vi.mocked(useConfig<Config>);
const mockFetch = vi.fn();

describe('FuaHtmlViewer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', mockFetch);
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  it('does not send a FUA identifier to a cross-origin endpoint', async () => {
    mockUseConfig.mockReturnValue({
      fuaGeneratorEndpoint: 'https://untrusted.example/fua',
    } as Config);

    render(<FuaHtmlViewer fuaId="clinical-fua-id" />);

    await waitFor(() => expect(mockShowSnackbar).toHaveBeenCalledWith(expect.objectContaining({ kind: 'error' })));
    expect(mockFetch).not.toHaveBeenCalled();
    expect(screen.getAllByText('Could not load FUA document')).not.toHaveLength(0);
  });

  it('uses same-origin credentials and renders returned HTML in an inert iframe', async () => {
    mockUseConfig.mockReturnValue({ fuaGeneratorEndpoint: '/secure/fua-generator' } as Config);
    mockFetch.mockResolvedValue({
      ok: true,
      text: vi.fn().mockResolvedValue('<h1>FUA</h1><script>steal()</script>'),
    });

    render(<FuaHtmlViewer fuaId="clinical-fua-id" />);

    const iframe = await screen.findByTitle('FUA Document');
    const requestedUrl = new URL(mockFetch.mock.calls[0][0]);

    expect(requestedUrl.origin).toBe(window.location.origin);
    expect(requestedUrl.pathname).toBe('/secure/fua-generator');
    expect(requestedUrl.searchParams.get('fuaId')).toBe('clinical-fua-id');
    expect(mockFetch).toHaveBeenCalledWith(
      requestedUrl.toString(),
      expect.objectContaining({
        credentials: 'same-origin',
        method: 'GET',
        referrerPolicy: 'no-referrer',
      }),
    );
    expect(iframe).toHaveAttribute('sandbox', '');
    expect(iframe).toHaveAttribute('referrerpolicy', 'no-referrer');
    expect(iframe.getAttribute('srcdoc')).toContain("default-src 'none'");
    expect(iframe.getAttribute('srcdoc')).not.toContain('<script');
  });

  it('does not expose HTTP or backend details when the document request fails', async () => {
    mockUseConfig.mockReturnValue({ fuaGeneratorEndpoint: '/secure/fua-generator' } as Config);
    mockFetch.mockResolvedValue({
      ok: false,
      status: 503,
      statusText: 'SQLSTATE 57P01 internal endpoint /ws/rest/v1/fua',
    });

    render(<FuaHtmlViewer fuaId="clinical-fua-id" />);

    await waitFor(() =>
      expect(mockShowSnackbar).toHaveBeenCalledWith(
        expect.objectContaining({ kind: 'error', subtitle: 'Could not load FUA document' }),
      ),
    );
    expect(screen.queryByText(/SQLSTATE|\/ws\/rest|503/u)).not.toBeInTheDocument();
    expect(mockShowSnackbar.mock.calls.flatMap(([message]) => message.subtitle ?? []).join(' ')).not.toMatch(
      /SQLSTATE|\/ws\/rest|503/u,
    );
  });
});
