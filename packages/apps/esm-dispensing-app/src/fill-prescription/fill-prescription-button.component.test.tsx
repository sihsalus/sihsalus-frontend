import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { dispensingEditPrivilege } from '../constants';

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
    mockUserHasAccess.mockImplementation((privilege) => privilege === dispensingEditPrivilege);
  });

  it('shows the action with the frontend edit privilege', () => {
    render(<FillPrescriptionButton />);

    expect(mockUserHasAccess).toHaveBeenCalledWith(
      dispensingEditPrivilege,
      expect.objectContaining({ uuid: 'user-1' }),
    );
    expect(screen.getByRole('button', { name: 'Fill prescription' })).toBeInTheDocument();
  });

  it('hides the action when the user lacks the frontend edit privilege', () => {
    mockUserHasAccess.mockReturnValue(false);

    render(<FillPrescriptionButton />);

    expect(screen.queryByRole('button', { name: 'Fill prescription' })).not.toBeInTheDocument();
  });
});
