import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { useMockMode } from './api/mock-mode';
import { useIndicatorsHealth } from './hooks/useIndicatorsHealth';
import RootComponent from './root.component';

const mockRequireModulePrivilege = vi.hoisted(() => vi.fn(({ children }: { children: ReactNode }) => <>{children}</>));

vi.mock('./hooks/useIndicatorsHealth', () => ({ useIndicatorsHealth: vi.fn() }));
vi.mock('./api/mock-mode', () => ({ useMockMode: vi.fn() }));
vi.mock('./pages/IndicadoresPage', () => ({ default: () => <div>Indicadores page content</div> }));
vi.mock('./pages/IndicadorDetailPage', () => ({ default: () => <div>Detalle page content</div> }));
vi.mock('./pages/IndicadorFormPage', () => ({ default: () => <div>Formulario page content</div> }));
vi.mock('./pages/MetasPage', () => ({ default: () => <div>Metas page content</div> }));
vi.mock('./pages/ResultadosPage', () => ({ default: () => <div>Resultados page content</div> }));
vi.mock('@sihsalus/esm-rbac', () => ({
  AppErrorBoundary: ({ children }: { children: ReactNode }) => <>{children}</>,
  modulePrivileges: { indicators: 'app:indicadores' },
  RequireModulePrivilege: (props: { children: ReactNode; privilege: string }) => mockRequireModulePrivilege(props),
}));

const mockUseIndicatorsHealth = vi.mocked(useIndicatorsHealth);
const mockUseMockMode = vi.mocked(useMockMode);

const indicatorsBaseUrl = '/openmrs/spa/indicators';

const renderAt = (path: string) => {
  window.history.replaceState({}, '', `${indicatorsBaseUrl}${path}`);
  render(<RootComponent />);
};

describe('RootComponent health state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.getOpenmrsSpaBase = vi.fn(() => '/openmrs/spa/');
    mockUseMockMode.mockReturnValue({ isMockMode: false, isBackendAvailable: true });
  });

  it('runs the health check and enforces the indicators privilege', () => {
    renderAt('/');

    expect(mockUseIndicatorsHealth).toHaveBeenCalledTimes(1);
    expect(mockRequireModulePrivilege).toHaveBeenCalledWith(expect.objectContaining({ privilege: 'app:indicadores' }));
  });

  it('shows a stable Spanish failure message without technical details', () => {
    mockUseMockMode.mockReturnValue({
      isMockMode: false,
      isBackendAvailable: false,
      errorMessage: 'Network Error: upstream 502',
    });
    renderAt('/');

    expect(screen.getByText('Servicio de indicadores no disponible')).toBeInTheDocument();
    expect(screen.getByText('No se mostrarán datos de ejemplo ni se simularán operaciones.')).toBeInTheDocument();
    expect(screen.queryByText(/Network Error|502/)).not.toBeInTheDocument();
  });

  it('labels explicit demo data and states that writes are not simulated', () => {
    mockUseMockMode.mockReturnValue({
      isMockMode: true,
      isBackendAvailable: false,
      errorMessage: 'SQL connection refused',
    });
    renderAt('/');

    expect(screen.getByText('Datos de demostración activos')).toBeInTheDocument();
    expect(screen.getByText(/ninguna escritura se simulará/i)).toBeInTheDocument();
    expect(screen.queryByText(/SQL connection refused/)).not.toBeInTheDocument();
  });
});

describe('RootComponent lazy routed pages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.getOpenmrsSpaBase = vi.fn(() => '/openmrs/spa/');
    mockUseMockMode.mockReturnValue({ isMockMode: false, isBackendAvailable: true });
  });

  it('mounts only the active page and keeps the module header and tabs visible', async () => {
    renderAt('/');

    expect(screen.getByText('Indicadores Clínicos')).toBeInTheDocument();
    expect(await screen.findByText('Indicadores page content')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Indicadores' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByText('Resultados page content')).not.toBeInTheDocument();
    expect(screen.queryByText('Metas page content')).not.toBeInTheDocument();
  });

  it('navigates to /resultados and mounts the Resultados page when the Resultados tab is clicked', async () => {
    renderAt('/');
    await screen.findByText('Indicadores page content');

    fireEvent.click(screen.getByRole('tab', { name: 'Resultados' }));

    expect(await screen.findByText('Resultados page content')).toBeInTheDocument();
    await waitFor(() => expect(window.location.pathname).toBe(`${indicatorsBaseUrl}/resultados`));
    expect(screen.getByRole('tab', { name: 'Resultados' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByText('Indicadores page content')).not.toBeInTheDocument();
  });

  it('navigates to /metas and mounts the Metas page when the Metas tab is clicked', async () => {
    renderAt('/');
    await screen.findByText('Indicadores page content');

    fireEvent.click(screen.getByRole('tab', { name: 'Metas' }));

    expect(await screen.findByText('Metas page content')).toBeInTheDocument();
    await waitFor(() => expect(window.location.pathname).toBe(`${indicatorsBaseUrl}/metas`));
    expect(screen.getByRole('tab', { name: 'Metas' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByText('Indicadores page content')).not.toBeInTheDocument();
  });

  it('deep-links to /metas with the Metas tab selected and the Metas page mounted', async () => {
    renderAt('/metas');

    expect(await screen.findByText('Metas page content')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Metas' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByText('Indicadores page content')).not.toBeInTheDocument();
    expect(screen.queryByText('Resultados page content')).not.toBeInTheDocument();
  });
});
