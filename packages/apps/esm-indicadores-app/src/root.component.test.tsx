import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { useMockMode } from './api/mock-mode';
import { useIndicatorsHealth } from './hooks/useIndicatorsHealth';
import RootComponent from './root.component';

const mockRequireModulePrivilege = vi.hoisted(() => vi.fn(({ children }: { children: ReactNode }) => <>{children}</>));

vi.mock('./hooks/useIndicatorsHealth', () => ({ useIndicatorsHealth: vi.fn() }));
vi.mock('./api/mock-mode', () => ({ useMockMode: vi.fn() }));
vi.mock('./pages/IndicadoresPage', () => ({ default: () => <div>Indicadores</div> }));
vi.mock('./pages/IndicadorDetailPage', () => ({ default: () => <div>Detalle</div> }));
vi.mock('./pages/IndicadorFormPage', () => ({ default: () => <div>Formulario</div> }));
vi.mock('./pages/MetasPage', () => ({ default: () => <div>Metas</div> }));
vi.mock('./pages/ResultadosPage', () => ({ default: () => <div>Resultados</div> }));
vi.mock('@sihsalus/esm-rbac', () => ({
  AppErrorBoundary: ({ children }: { children: ReactNode }) => <>{children}</>,
  modulePrivileges: { indicators: 'app:indicadores' },
  RequireModulePrivilege: (props: { children: ReactNode; privilege: string }) => mockRequireModulePrivilege(props),
}));

const mockUseIndicatorsHealth = vi.mocked(useIndicatorsHealth);
const mockUseMockMode = vi.mocked(useMockMode);

describe('RootComponent health state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState({}, '', '/openmrs/spa/indicators/');
    globalThis.getOpenmrsSpaBase = vi.fn(() => '/openmrs/spa/');
    mockUseMockMode.mockReturnValue({ isMockMode: false, isBackendAvailable: true });
  });

  it('runs the health check and enforces the indicators privilege', () => {
    render(<RootComponent />);

    expect(mockUseIndicatorsHealth).toHaveBeenCalledTimes(1);
    expect(mockRequireModulePrivilege).toHaveBeenCalledWith(expect.objectContaining({ privilege: 'app:indicadores' }));
  });

  it('shows a stable Spanish failure message without technical details', () => {
    mockUseMockMode.mockReturnValue({
      isMockMode: false,
      isBackendAvailable: false,
      errorMessage: 'Network Error: upstream 502',
    });
    render(<RootComponent />);

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
    render(<RootComponent />);

    expect(screen.getByText('Datos de demostración activos')).toBeInTheDocument();
    expect(screen.getByText(/ninguna escritura se simulará/i)).toBeInTheDocument();
    expect(screen.queryByText(/SQL connection refused/)).not.toBeInTheDocument();
  });
});
