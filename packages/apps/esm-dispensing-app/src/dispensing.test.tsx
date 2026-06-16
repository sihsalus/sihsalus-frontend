import { render } from '@testing-library/react';
import type { ReactNode } from 'react';
import Dispensing from './dispensing.component';

type RequirePrivilegeProps = {
  privilege: string | string[];
  children?: ReactNode;
};

const mockRequirePrivilege = vi.hoisted(() => vi.fn((_props: RequirePrivilegeProps): ReactNode => null));

vi.mock('@sihsalus/esm-rbac', () => ({
  RequirePrivilege: (props: RequirePrivilegeProps) => mockRequirePrivilege(props),
}));

describe('<div/>', () => {
  beforeEach(() => {
    mockRequirePrivilege.mockImplementation(({ children }) => <>{children}</>);
  });

  test('renders dispening without error', () => {
    render(<Dispensing />);

    expect(mockRequirePrivilege).toHaveBeenCalledWith(expect.objectContaining({ privilege: 'app:dispensing' }));
  });

  test('does not render the dashboard slot when the privilege guard blocks access', () => {
    mockRequirePrivilege.mockImplementation(() => null);

    render(<Dispensing />);

    expect(mockRequirePrivilege).toHaveBeenCalledWith(expect.objectContaining({ privilege: 'app:dispensing' }));
  });
});
