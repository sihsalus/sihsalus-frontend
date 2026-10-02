import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import PeruHomeActions from './peru-home-actions.component';

type RequirePrivilegeProps = {
  privilege: string | string[];
  hideUnauthorized?: boolean;
  children?: ReactNode;
};

const mockRequirePrivilege = vi.hoisted(() => vi.fn((_props: RequirePrivilegeProps): ReactNode => null));
const mockUseConfig = vi.hoisted(() => vi.fn(() => ({ search: { showRecentlySearchedPatients: true } })));

vi.mock('@sihsalus/esm-rbac', () => ({
  RequirePrivilege: (props: RequirePrivilegeProps) => mockRequirePrivilege(props),
}));

vi.mock('@openmrs/esm-framework', () => ({
  useConfig: mockUseConfig,
  ConfigurableLink: ({ children, to, ...props }: { children?: ReactNode; to: string }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, defaultValue?: string) => defaultValue ?? key,
  }),
}));

describe('PeruHomeActions', () => {
  beforeEach(() => {
    vi.stubGlobal('spaBase', '/openmrs/spa');
    mockUseConfig.mockReturnValue({ search: { showRecentlySearchedPatients: true } });
    mockRequirePrivilege.mockImplementation(({ children }) => <>{children}</>);
  });

  it('protects each quick action with the expected privilege', () => {
    render(<PeruHomeActions />);

    expect(mockRequirePrivilege).toHaveBeenCalledWith(
      expect.objectContaining({ privilege: 'app:opciones.busquedaPaciente', hideUnauthorized: true }),
    );
    expect(mockRequirePrivilege).toHaveBeenCalledWith(
      expect.objectContaining({
        privilege: ['app:opciones.busquedaPaciente', 'app:hoja.clinica'],
        hideUnauthorized: true,
      }),
    );
    expect(mockRequirePrivilege).toHaveBeenCalledWith(
      expect.objectContaining({ privilege: 'app:opciones.registrarPaciente', hideUnauthorized: true }),
    );
    expect(mockRequirePrivilege).toHaveBeenCalledWith(
      expect.objectContaining({ privilege: 'app:home.colasAtencion', hideUnauthorized: true }),
    );
    expect(mockRequirePrivilege).toHaveBeenCalledWith(
      expect.objectContaining({ privilege: 'app:home.citas', hideUnauthorized: true }),
    );
    expect(mockRequirePrivilege).toHaveBeenCalledWith(
      expect.objectContaining({ privilege: 'app:home.laboratorio', hideUnauthorized: true }),
    );
    expect(mockRequirePrivilege).toHaveBeenCalledWith(
      expect.objectContaining({ privilege: 'app:home.farmacia', hideUnauthorized: true }),
    );
    expect(mockRequirePrivilege).toHaveBeenCalledWith(
      expect.objectContaining({ privilege: 'app:home.fua', hideUnauthorized: true }),
    );
  });

  it('shows only admission quick actions for an admission user', () => {
    const admissionPrivileges = new Set([
      'app:opciones.busquedaPaciente',
      'app:opciones.registrarPaciente',
      'app:home.colasAtencion',
      'app:home.citas',
    ]);
    mockRequirePrivilege.mockImplementation(({ children, privilege }) => {
      const privileges = Array.isArray(privilege) ? privilege : [privilege];
      return privileges.every((item) => admissionPrivileges.has(item)) ? <>{children}</> : null;
    });

    render(<PeruHomeActions />);

    expect(screen.getByText('searchPatient')).toBeInTheDocument();
    expect(screen.getByText('registerPatient')).toBeInTheDocument();
    expect(screen.getByText('careQueues')).toBeInTheDocument();
    expect(screen.getByText('appointments')).toBeInTheDocument();
    expect(screen.queryByText('laboratory')).not.toBeInTheDocument();
    expect(screen.queryByText('dispensing')).not.toBeInTheDocument();
    expect(screen.queryByText('fua')).not.toBeInTheDocument();
  });

  it('shows patient search and the laboratory quick action for a laboratory user', () => {
    const laboratoryPrivileges = new Set(['app:opciones.busquedaPaciente', 'app:home.laboratorio']);
    mockRequirePrivilege.mockImplementation(({ children, privilege }) => {
      const privileges = Array.isArray(privilege) ? privilege : [privilege];
      return privileges.every((item) => laboratoryPrivileges.has(item)) ? <>{children}</> : null;
    });

    render(<PeruHomeActions />);

    expect(screen.getByText('searchPatient')).toBeInTheDocument();
    expect(screen.getByText('laboratory')).toBeInTheDocument();
    expect(screen.queryByText('registerPatient')).not.toBeInTheDocument();
    expect(screen.queryByText('dispensing')).not.toBeInTheDocument();
    expect(screen.queryByText('fua')).not.toBeInTheDocument();
  });

  it('shows patient search and FUA for a FUA user', () => {
    const fuaPrivileges = new Set(['app:opciones.busquedaPaciente', 'app:home.fua']);
    mockRequirePrivilege.mockImplementation(({ children, privilege }) => {
      const privileges = Array.isArray(privilege) ? privilege : [privilege];
      return privileges.every((item) => fuaPrivileges.has(item)) ? <>{children}</> : null;
    });

    render(<PeruHomeActions />);

    expect(screen.getByText('searchPatient')).toBeInTheDocument();
    expect(screen.getByText('fua')).toBeInTheDocument();
    expect(screen.queryByText('registerPatient')).not.toBeInTheDocument();
    expect(screen.queryByText('laboratory')).not.toBeInTheDocument();
  });

  it('shows only the dispensing quick action for a pharmacy user', () => {
    mockRequirePrivilege.mockImplementation(({ children, privilege }) =>
      privilege === 'app:home.farmacia' ? <>{children}</> : null,
    );

    render(<PeruHomeActions />);

    expect(screen.getByText('dispensing')).toBeInTheDocument();
    expect(screen.queryByText('searchPatient')).not.toBeInTheDocument();
    expect(screen.queryByText('registerPatient')).not.toBeInTheDocument();
    expect(screen.queryByText('laboratory')).not.toBeInTheDocument();
    expect(screen.queryByText('fua')).not.toBeInTheDocument();
  });

  it('links recent patients immediately after search for a user with both permissions', () => {
    const grantedPrivileges = new Set(['app:opciones.busquedaPaciente', 'app:hoja.clinica']);
    mockRequirePrivilege.mockImplementation(({ children, privilege }) => {
      const privileges = Array.isArray(privilege) ? privilege : [privilege];
      return privileges.every((item) => grantedPrivileges.has(item)) ? <>{children}</> : null;
    });

    render(<PeruHomeActions />);

    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAttribute('href', '/openmrs/spa/search');
    expect(links[1]).toHaveAccessibleName('recentPatients recentPatientsDescription');
    expect(links[1]).toHaveAttribute('href', '/openmrs/spa/recent-patients');
    expect(mockUseConfig).toHaveBeenCalledWith({ externalModuleName: '@sihsalus/esm-patient-search-app' });
  });

  it.each([
    [],
    ['app:opciones.busquedaPaciente'],
    ['app:hoja.clinica'],
  ])('hides recent patients without both permissions: %j', (...grantedPrivileges: string[]) => {
    mockRequirePrivilege.mockImplementation(({ children, privilege }) => {
      const privileges = Array.isArray(privilege) ? privilege : [privilege];
      return privileges.every((item) => grantedPrivileges.includes(item)) ? <>{children}</> : null;
    });

    render(<PeruHomeActions />);

    expect(screen.queryByText('recentPatients')).not.toBeInTheDocument();
    expect(mockUseConfig).not.toHaveBeenCalled();
  });

  it('hides recent patients when disabled while preserving the other shortcuts', () => {
    mockUseConfig.mockReturnValue({ search: { showRecentlySearchedPatients: false } });

    render(<PeruHomeActions />);

    expect(screen.queryByText('recentPatients')).not.toBeInTheDocument();
    expect(screen.getByText('searchPatient')).toBeInTheDocument();
    expect(screen.getByText('registerPatient')).toBeInTheDocument();
  });

  it('keeps the other shortcuts visible while recent-patients configuration is unavailable', () => {
    const pendingConfig = new Promise<never>(() => {});
    mockUseConfig.mockImplementation(() => {
      throw pendingConfig;
    });

    render(<PeruHomeActions />);

    expect(screen.queryByText('recentPatients')).not.toBeInTheDocument();
    expect(screen.getByText('searchPatient')).toBeInTheDocument();
    expect(screen.getByText('registerPatient')).toBeInTheDocument();
  });
});
