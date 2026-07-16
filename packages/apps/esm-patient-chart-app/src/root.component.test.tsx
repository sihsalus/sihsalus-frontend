import { render, screen, waitFor } from '@testing-library/react';
import { StrictMode, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockNavigate = vi.hoisted(() => vi.fn());
const mockShowSnackbar = vi.hoisted(() => vi.fn());
const mockUseSession = vi.hoisted(() => vi.fn());

vi.mock('@openmrs/esm-framework', () => ({
  navigate: mockNavigate,
  showSnackbar: mockShowSnackbar,
  useSession: mockUseSession,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_key: string, defaultValue: string) => defaultValue }),
}));

vi.mock('@sihsalus/esm-rbac', () => ({
  AppErrorBoundary: ({ children }: { children?: ReactNode }) => <>{children}</>,
}));

vi.mock('./patient-chart/patient-chart.component', () => ({
  default: () => <div>Patient chart</div>,
}));

describe('Patient chart root', () => {
  beforeEach(() => {
    vi.stubGlobal('spaBase', '/openmrs/spa');
    vi.stubGlobal('getOpenmrsSpaBase', () => '/openmrs/spa');
    window.history.pushState({}, 'Patient chart', '/openmrs/spa/patient/test-patient/chart');
    mockUseSession.mockReturnValue({
      authenticated: true,
      user: {
        privileges: [{ name: 'app:hoja.clinica', display: 'Historia clínica' }],
        roles: [],
      },
    });
    mockNavigate.mockClear();
    mockShowSnackbar.mockClear();
  });

  it('allows direct chart access with the clinical chart privilege', async () => {
    const { default: Root } = await import('./root.component');

    render(<Root />);

    expect(screen.getByText('Patient chart')).toBeInTheDocument();
    expect(mockShowSnackbar).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('shows one informational message before redirecting unauthorized users to patient search', async () => {
    mockUseSession.mockReturnValue({
      authenticated: true,
      user: {
        privileges: [{ name: 'app:hoja.clinica.resumen', display: 'Resumen clínico' }],
        roles: [],
      },
    });
    const { default: Root } = await import('./root.component');

    render(
      <StrictMode>
        <Root />
      </StrictMode>,
    );

    expect(screen.queryByText('Patient chart')).not.toBeInTheDocument();
    await waitFor(() => {
      expect(mockShowSnackbar).toHaveBeenCalledTimes(1);
      expect(mockShowSnackbar).toHaveBeenCalledWith({
        kind: 'info',
        isLowContrast: true,
        title: 'Acceso restringido',
        subtitle: 'No tiene permisos para acceder a la historia clínica. Fue redirigido a la búsqueda de pacientes.',
      });
      expect(mockNavigate).toHaveBeenCalledTimes(1);
      expect(mockNavigate).toHaveBeenCalledWith({ to: '/openmrs/spa/search' });
    });
    expect(mockShowSnackbar.mock.invocationCallOrder[0]).toBeLessThan(mockNavigate.mock.invocationCallOrder[0]);
  });

  it('redirects admission users even when a broad chart privilege is inherited', async () => {
    mockUseSession.mockReturnValue({
      authenticated: true,
      user: {
        privileges: [
          { name: 'app:home.admision', display: 'Admisión' },
          { name: 'app:hoja.clinica', display: 'Historia clínica' },
        ],
        roles: [],
      },
    });
    const { default: Root } = await import('./root.component');

    render(<Root />);

    expect(screen.queryByText('Patient chart')).not.toBeInTheDocument();
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith({ to: '/openmrs/spa/search' }));
  });
});
