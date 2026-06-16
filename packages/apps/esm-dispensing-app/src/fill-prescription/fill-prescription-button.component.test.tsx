import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import FillPrescriptionButton from './fill-prescription-button.component';

type UserHasAccessProps = {
  privilege: string | string[];
  children?: ReactNode;
};

const mockUserHasAccess = vi.hoisted(() => vi.fn((_props: UserHasAccessProps): ReactNode => null));

vi.mock('@openmrs/esm-framework', () => ({
  AddIcon: () => <span aria-hidden="true" />,
  UserHasAccess: (props: UserHasAccessProps) => mockUserHasAccess(props),
  launchWorkspace2: vi.fn(),
  openmrsFetch: vi.fn(),
  restBaseUrl: '/ws/rest/v1',
  showModal: vi.fn(),
  showSnackbar: vi.fn(),
  useLayoutType: () => 'desktop',
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, defaultValue?: string) => defaultValue,
  }),
}));

describe('FillPrescriptionButton', () => {
  beforeEach(() => {
    mockUserHasAccess.mockImplementation(({ children }) => <>{children}</>);
  });

  it('requires the dispensing create privilege', () => {
    render(<FillPrescriptionButton />);

    expect(mockUserHasAccess).toHaveBeenCalledWith(
      expect.objectContaining({ privilege: 'Task: dispensing.create.dispense' }),
    );
    expect(screen.getByRole('button', { name: 'Fill prescription' })).toBeInTheDocument();
  });

  it('hides the action when the user cannot create dispenses', () => {
    mockUserHasAccess.mockImplementation(() => null);

    render(<FillPrescriptionButton />);

    expect(screen.queryByRole('button', { name: 'Fill prescription' })).not.toBeInTheDocument();
  });
});
