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

vi.mock('@sihsalus/esm-rbac', () => ({
  RequirePrivilege: (props: RequirePrivilegeProps) => mockRequirePrivilege(props),
}));

vi.mock('@openmrs/esm-framework', () => ({
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
    mockRequirePrivilege.mockImplementation(({ children }) => <>{children}</>);
  });

  it('protects each quick action with the expected privilege', () => {
    render(<PeruHomeActions />);

    expect(mockRequirePrivilege).toHaveBeenCalledWith(
      expect.objectContaining({ privilege: 'app:opciones.busquedaPaciente', hideUnauthorized: true }),
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
      return privileges.some((item) => admissionPrivileges.has(item)) ? <>{children}</> : null;
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
      return privileges.some((item) => laboratoryPrivileges.has(item)) ? <>{children}</> : null;
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
      return privileges.some((item) => fuaPrivileges.has(item)) ? <>{children}</> : null;
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
});
