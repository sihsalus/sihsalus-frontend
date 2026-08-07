vi.mock('@carbon/react', async () => {
  const actual = await vi.importActual('@carbon/react');
  const React = await vi.importActual<typeof import('react')>('react');

  return {
    ...actual,
    OverflowMenuItem: React.forwardRef<
      HTMLButtonElement,
      React.ComponentPropsWithoutRef<'button'> & { itemText?: React.ReactNode }
    >(function MockOverflowMenuItem({ itemText, onClick, ...props }, ref) {
      return (
        <button {...props} onClick={onClick} ref={ref} role="menuitem" type="button">
          {itemText}
        </button>
      );
    }),
  };
});

import { navigate } from '@openmrs/esm-framework';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import ScheduleAppointmentAction from './schedule-appointment-action.component';

const mockNavigate = vi.mocked(navigate);

describe('ScheduleAppointmentAction', () => {
  beforeEach(() => {
    vi.stubGlobal('spaBase', '/openmrs/spa');
  });

  it('opens appointment creation for the patient without depending on active visit state', async () => {
    const closeMenu = vi.fn();
    render(<ScheduleAppointmentAction closeMenu={closeMenu} patientUuid="patient-uuid" />);

    await userEvent.click(screen.getByRole('menuitem', { name: /schedule appointment/i }));

    expect(closeMenu).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith({
      to: expect.stringContaining('/home/appointments/patient/patient-uuid?action=create'),
    });
  });
});
