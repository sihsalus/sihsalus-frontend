import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type RequirePrivilegeProps = {
  privilege: string | string[];
  children?: ReactNode;
};

const mockRequirePrivilege = vi.hoisted(() => vi.fn((_props: RequirePrivilegeProps): ReactNode => null));

vi.mock('@sihsalus/esm-rbac', () => ({
  AppErrorBoundary: ({ children }: { children?: ReactNode }) => <>{children}</>,
  RequirePrivilege: (props: RequirePrivilegeProps) => mockRequirePrivilege(props),
}));

vi.mock('@openmrs/esm-framework', () => ({
  ExtensionSlot: () => <div>Breadcrumbs</div>,
  omrsOfflineCachingStrategyHttpHeaderName: 'x-omrs-offline-caching-strategy',
  useConnectivity: () => true,
  useSession: () => ({ user: { uuid: 'test-user' } }),
}));

vi.mock('./offline.resources', () => ({
  fetchAddressTemplate: vi.fn(),
  fetchAllRelationshipTypes: vi.fn(),
  fetchPatientIdentifierTypesWithSources: vi.fn(),
  ResourcesContext: React.createContext(null),
}));

vi.mock('swr/immutable', () => ({
  default: () => ({
    data: [],
    error: null,
    isLoading: false,
  }),
}));

vi.mock('./patient-registration/form-manager', () => ({
  FormManager: {
    savePatientFormOnline: vi.fn(),
    savePatientFormOffline: vi.fn(),
  },
}));

vi.mock('./patient-registration/patient-registration.component', () => ({
  PatientRegistration: () => <div>Patient registration page</div>,
}));

vi.mock('./bulk-patient-import/bulk-patient-import.component', () => ({
  default: () => <div>Bulk patient import page</div>,
}));

describe('Patient registration root', () => {
  beforeEach(() => {
    vi.stubGlobal('getOpenmrsSpaBase', () => '/openmrs/spa');
    window.history.pushState({}, 'Patient registration', '/openmrs/spa/patient-registration');
    mockRequirePrivilege.mockClear();
    mockRequirePrivilege.mockImplementation(({ children }) => <>{children}</>);
  });

  it('protects patient registration with the register patient frontend privilege', async () => {
    const { default: Root } = await import('./root.component');

    render(<Root />);

    expect(mockRequirePrivilege).toHaveBeenCalledWith(
      expect.objectContaining({ privilege: 'app:opciones.registrarPaciente' }),
    );
    expect(screen.getByText('Patient registration page')).toBeInTheDocument();
  }, 15000);

  it('does not render patient registration when the privilege guard blocks access', async () => {
    mockRequirePrivilege.mockImplementation(() => null);
    const { default: Root } = await import('./root.component');

    render(<Root />);

    expect(screen.queryByText('Patient registration page')).not.toBeInTheDocument();
  }, 15000);

  it('protects bulk import with Manage Patients without also requiring the registration privilege', async () => {
    window.history.pushState({}, 'Bulk patient import', '/openmrs/spa/patient-import');
    mockRequirePrivilege.mockImplementation(({ children, privilege }) =>
      privilege === 'Manage Patients' ? <>{children}</> : null,
    );
    const { default: Root } = await import('./root.component');

    render(<Root />);

    expect(mockRequirePrivilege).toHaveBeenCalledWith(expect.objectContaining({ privilege: 'Manage Patients' }));
    expect(mockRequirePrivilege).not.toHaveBeenCalledWith(
      expect.objectContaining({ privilege: 'app:opciones.registrarPaciente' }),
    );
    expect(screen.getByText('Bulk patient import page')).toBeInTheDocument();
  }, 15000);
});
