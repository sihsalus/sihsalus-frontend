import { navigate } from '@openmrs/esm-framework';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mockPatient } from 'test-utils';

import EditPatientDetailsButton from './edit-patient-details-button.component';

const mockNavigate = vi.mocked(navigate);

describe('EditPatientDetailsButton', () => {
  const patientUuid = mockPatient.uuid;

  it('should navigate to the edit page when clicked', async () => {
    const user = userEvent.setup();

    render(<EditPatientDetailsButton patientUuid={patientUuid} />);

    const button = screen.getByRole('menuitem');
    await user.click(button);

    expect(mockNavigate).toHaveBeenCalledWith({ to: expect.stringContaining(`/patient/${patientUuid}/edit`) });
  });

  it('should call the onTransition function when provided', async () => {
    const user = userEvent.setup();

    const onTransitionMock = vi.fn();
    render(<EditPatientDetailsButton patientUuid={patientUuid} onTransition={onTransitionMock} />);

    const button = screen.getByRole('menuitem');
    await user.click(button);

    expect(onTransitionMock).toHaveBeenCalled();
  });
});
