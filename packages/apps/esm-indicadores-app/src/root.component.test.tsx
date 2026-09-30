import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useConfig } from '@openmrs/esm-framework';
import type { ReactNode } from 'react';
import { type ConfigObject } from './config-schema';
import RootComponent from './root.component';

const mockRequireModulePrivilege = vi.hoisted(() => vi.fn(({ children }: { children: ReactNode }) => <>{children}</>));

vi.mock('@openmrs/esm-framework', () => ({ useConfig: vi.fn() }));
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

const mockUseConfig = vi.mocked(useConfig);

const defaultTestConfig: ConfigObject = {
  indicatorsApiPath: '/ws/module/indicators/api',
  reportesSqlApiPath: '/services/reportes-sql',
  bypassPrivilegeGuard: false,
};

const indicatorsBaseUrl = '/openmrs/spa/indicators';

const renderAt = (path: string) => {
  window.history.replaceState({}, '', `${indicatorsBaseUrl}${path}`);
  render(<RootComponent />);
};

describe('RootComponent privilege guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.getOpenmrsSpaBase = vi.fn(() => '/openmrs/spa/');
    mockUseConfig.mockReturnValue(defaultTestConfig);
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
    mockUseConfig.mockReturnValue(defaultTestConfig);
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

describe('RootComponent privilege guard bypass (dev-only)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.getOpenmrsSpaBase = vi.fn(() => '/openmrs/spa/');
  });

  it('enforces the guard by default (bypassPrivilegeGuard: false)', async () => {
    mockUseConfig.mockReturnValue(defaultTestConfig);
    renderAt('/');

    expect(mockRequireModulePrivilege).toHaveBeenCalledWith(expect.objectContaining({ privilege: 'app:indicadores' }));
    expect(await screen.findByText('Indicadores page content')).toBeInTheDocument();
  });

  it('skips RequireModulePrivilege when bypassPrivilegeGuard is true', async () => {
    mockUseConfig.mockReturnValue({ ...defaultTestConfig, bypassPrivilegeGuard: true });
    renderAt('/');

    expect(mockRequireModulePrivilege).not.toHaveBeenCalled();
    expect(await screen.findByText('Indicadores page content')).toBeInTheDocument();
  });
});
