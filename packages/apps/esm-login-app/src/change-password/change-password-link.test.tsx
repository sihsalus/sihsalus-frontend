import { showModal } from '@openmrs/esm-framework';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import ChangePasswordLink from './change-password-link.extension';

const mockShowModal = vi.mocked(showModal);

describe('ChangePasswordLink', () => {
  it('should launch the change password modal', async () => {
    const user = userEvent.setup();

    render(<ChangePasswordLink />);

    const changePasswordLink = screen.getByRole('button', {
      name: /Change/i,
    });

    await user.click(changePasswordLink);

    expect(mockShowModal).toHaveBeenCalledTimes(1);
    expect(mockShowModal).toHaveBeenCalledWith('change-password-modal', {
      size: 'sm',
      closeModal: expect.any(Function),
    });
  });
});
