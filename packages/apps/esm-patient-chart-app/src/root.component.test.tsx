import { render, screen, waitFor } from '@testing-library/react';
import { StrictMode, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type RequirePrivilegeProps = {
  privilege: string | string[];
  children?: ReactNode;
  fallback?: ReactNode;
};

const mockRequirePrivilege = vi.hoisted(() => vi.fn((_props: RequirePrivilegeProps): ReactNode => null));
const mockNavigate = vi.hoisted(() => vi.fn());
const mockShowSnackbar = vi.hoisted(() => vi.fn());

vi.mock('@openmrs/esm-framework', () => ({
  navigate: mockNavigate,
  showSnackbar: mockShowSnackbar,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_key: string, defaultValue: string) => defaultValue }),
}));

vi.mock('@sihsalus/esm-rbac', () => ({
  AppErrorBoundary: ({ children }: { children?: ReactNode }) => <>{children}</>,
  RequirePrivilege: (props: RequirePrivilegeProps) => mockRequirePrivilege(props),
}));

vi.mock('./patient-chart/patient-chart.component', () => ({
  default: () => <div>Patient chart</div>,
}));

describe('Patient chart root', () => {
  beforeEach(() => {
    vi.stubGlobal('spaBase', '/openmrs/spa');
    vi.stubGlobal('getOpenmrsSpaBase', () => '/openmrs/spa');
    window.history.pushState({}, 'Patient chart', '/openmrs/spa/patient/test-patient/chart');
    mockRequirePrivilege.mockImplementation(({ children }) => <>{children}</>);
    mockNavigate.mockClear();
    mockShowSnackbar.mockClear();
  });

  it('protects direct chart access with the clinical chart privilege', async () => {
    const { default: Root } = await import('./root.component');

    render(<Root />);

    expect(mockRequirePrivilege).toHaveBeenCalledWith(
      expect.objectContaining({ privilege: 'app:hoja.clinica', fallback: expect.anything() }),
    );
    expect(screen.getByText('Patient chart')).toBeInTheDocument();
    expect(mockShowSnackbar).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('shows one informational message before redirecting unauthorized users to home', async () => {
    mockRequirePrivilege.mockImplementation(({ fallback }) => <>{fallback}</>);
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
});
