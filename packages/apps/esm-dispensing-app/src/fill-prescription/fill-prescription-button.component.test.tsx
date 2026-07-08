import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { dispensingEditPrivilege, PRIVILEGE_CREATE_DISPENSE } from '../constants';

import FillPrescriptionButton from './fill-prescription-button.component';

const mockUseSession = vi.hoisted(() => vi.fn());
const mockUserHasAccess = vi.hoisted(() => vi.fn());

vi.mock('@openmrs/esm-framework', () => ({
  AddIcon: () => <span aria-hidden="true" />,
  launchWorkspace2: vi.fn(),
  openmrsFetch: vi.fn(),
  restBaseUrl: '/ws/rest/v1',
  showModal: vi.fn(),
  showSnackbar: vi.fn(),
  useLayoutType: () => 'desktop',
  useSession: () => mockUseSession(),
  userHasAccess: (...args: Array<unknown>) => mockUserHasAccess(...args),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, defaultValue?: string) => defaultValue,
  }),
}));

describe('FillPrescriptionButton', () => {
  beforeEach(() => {
    mockUseSession.mockReturnValue({ user: { uuid: 'user-1' } });
    mockUserHasAccess.mockImplementation(
      (privilege) => privilege === dispensingEditPrivilege || privilege === PRIVILEGE_CREATE_DISPENSE,
    );
  });

  it('requires the dispensing create privilege', () => {
    render(<FillPrescriptionButton />);

    expect(mockUserHasAccess).toHaveBeenCalledWith(
      dispensingEditPrivilege,
      expect.objectContaining({ uuid: 'user-1' }),
    );
    expect(mockUserHasAccess).toHaveBeenCalledWith(
      PRIVILEGE_CREATE_DISPENSE,
      expect.objectContaining({ uuid: 'user-1' }),
    );
    expect(screen.getByRole('button', { name: 'Fill prescription' })).toBeInTheDocument();
  });

  it('hides the action when the user cannot create dispenses', () => {
    mockUserHasAccess.mockReturnValue(false);

    render(<FillPrescriptionButton />);

    expect(screen.queryByRole('button', { name: 'Fill prescription' })).not.toBeInTheDocument();
  });
});
