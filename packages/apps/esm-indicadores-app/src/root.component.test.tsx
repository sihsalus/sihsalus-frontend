import { render, screen } from '@testing-library/react';
import { useLeftNav } from '@openmrs/esm-framework';
import type { ReactNode } from 'react';
import RootComponent from './root.component';

const mockRequireModulePrivilege = vi.hoisted(() => vi.fn(({ children }: { children: ReactNode }) => <>{children}</>));

vi.mock('@openmrs/esm-framework', () => ({ useLeftNav: vi.fn() }));
vi.mock('./pages/PanelPage', () => ({ default: () => <div>Panel page content</div> }));
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

const mockUseLeftNav = vi.mocked(useLeftNav);

const indicatorsBaseUrl = '/openmrs/spa/indicators';

const renderAt = (path: string) => {
  window.history.replaceState({}, '', `${indicatorsBaseUrl}${path}`);
  render(<RootComponent />);
};

describe('RootComponent privilege guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.getOpenmrsSpaBase = vi.fn(() => '/openmrs/spa/');
  });

  it('enforces the indicators privilege', () => {
    renderAt('/');

    expect(mockRequireModulePrivilege).toHaveBeenCalledWith(expect.objectContaining({ privilege: 'app:indicadores' }));
  });
});

describe('RootComponent lazy routed pages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.getOpenmrsSpaBase = vi.fn(() => '/openmrs/spa/');
  });

  it('mounts the Panel page by default and keeps the module header visible', async () => {
    renderAt('/');

    expect(screen.getByText('Indicadores Clínicos')).toBeInTheDocument();
    expect(await screen.findByText('Panel page content')).toBeInTheDocument();
    expect(screen.queryByText('Indicadores page content')).not.toBeInTheDocument();
    expect(screen.queryByText('Resultados page content')).not.toBeInTheDocument();
    expect(screen.queryByText('Metas page content')).not.toBeInTheDocument();
  });

  it('deep-links to /resultados and mounts only the Resultados page', async () => {
    renderAt('/resultados');

    expect(await screen.findByText('Resultados page content')).toBeInTheDocument();
    expect(screen.queryByText('Panel page content')).not.toBeInTheDocument();
    expect(screen.queryByText('Indicadores page content')).not.toBeInTheDocument();
  });

  it('deep-links to /indicadores and mounts only the Indicadores page', async () => {
    renderAt('/indicadores');

    expect(await screen.findByText('Indicadores page content')).toBeInTheDocument();
    expect(screen.queryByText('Panel page content')).not.toBeInTheDocument();
    expect(screen.queryByText('Resultados page content')).not.toBeInTheDocument();
  });

  it('activates the module left navigation with the module-scoped base path', () => {
    renderAt('/');

    expect(mockUseLeftNav).toHaveBeenCalledWith({
      name: 'indicadores-nav-slot',
      basePath: '/openmrs/spa/indicators',
    });
  });

  it('reserves the shell left-nav width for every route, including the indicator detail', async () => {
    renderAt('/ind-001');

    const detail = await screen.findByText('Detalle page content');
    const shell = document.querySelector('.appShell');

    expect(shell).not.toBeNull();
    expect(shell?.contains(detail)).toBe(true);
  });

  it('deep-links to /metas and mounts only the Metas page', async () => {
    renderAt('/metas');

    expect(await screen.findByText('Metas page content')).toBeInTheDocument();
    expect(screen.queryByText('Panel page content')).not.toBeInTheDocument();
    expect(screen.queryByText('Resultados page content')).not.toBeInTheDocument();
  });
});
