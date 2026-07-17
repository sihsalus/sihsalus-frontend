import { render, screen } from '@testing-library/react';

import { careLogbookMergePrivileges } from './constants';
import Root from './root.component';

vi.mock('@sihsalus/esm-rbac', () => ({
  AppErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  RequirePrivilege: ({ children, privilege }: { children: React.ReactNode; privilege: string | string[] }) => (
    <div data-required-privileges={Array.isArray(privilege) ? privilege.join(',') : privilege}>{children}</div>
  ),
}));

vi.mock('./pages/admission-home.component', () => ({
  __esModule: true,
  default: () => <div>Admission home route</div>,
}));

vi.mock('./pages/patient-merge.component', () => ({
  __esModule: true,
  default: () => <div>Patient merge route</div>,
}));

vi.mock('./patient/patient-admission-detail.component', () => ({
  __esModule: true,
  default: () => <div>Patient admission detail route</div>,
}));

describe('Root', () => {
  beforeEach(() => {
    globalThis.getOpenmrsSpaBase = vi.fn(() => '/openmrs/spa/');
  });

  it('renders the care logbook home route', () => {
    window.history.pushState({}, 'Care logbook', '/openmrs/spa/home/care-logbook');

    render(<Root />);

    expect(screen.getByText('Admission home route')).toBeInTheDocument();
  });

  it('renders the duplicate patient merge route', () => {
    window.history.pushState({}, 'Care logbook merge', '/openmrs/spa/home/care-logbook/merge');

    render(<Root />);

    const mergeRoute = screen.getByText('Patient merge route');

    expect(mergeRoute).toBeInTheDocument();
    expect(mergeRoute.closest('[data-required-privileges]')).toHaveAttribute(
      'data-required-privileges',
      careLogbookMergePrivileges.join(','),
    );
  });

  it('renders the patient admission detail route', () => {
    window.history.pushState({}, 'Patient admission detail', '/openmrs/spa/home/care-logbook/patient/patient-uuid');

    render(<Root />);

    expect(screen.getByText('Patient admission detail route')).toBeInTheDocument();
  });
});
