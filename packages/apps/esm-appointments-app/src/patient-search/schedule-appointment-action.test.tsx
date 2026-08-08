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

import { launchWorkspace2, userHasAccess, useSession } from '@openmrs/esm-framework';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import ScheduleAppointmentAction, { ScheduleAppointmentPrimaryAction } from './schedule-appointment-action.component';

const mockLaunchWorkspace2 = vi.mocked(launchWorkspace2);
const mockUserHasAccess = vi.mocked(userHasAccess);
const mockUseSession = vi.mocked(useSession);

describe('ScheduleAppointmentAction', () => {
  beforeEach(() => {
    vi.stubGlobal('spaBase', '/openmrs/spa');
    mockUserHasAccess.mockReset();
    mockUseSession.mockReturnValue({ user: { uuid: 'admission-user' } } as ReturnType<typeof useSession>);
  });

  it('opens appointment creation for the patient without depending on active visit state', async () => {
    const closeMenu = vi.fn();
    render(<ScheduleAppointmentAction closeMenu={closeMenu} patientUuid="patient-uuid" />);

    await userEvent.click(screen.getByRole('menuitem', { name: /schedule appointment/i }));

    expect(closeMenu).toHaveBeenCalledTimes(1);
    expect(mockLaunchWorkspace2).toHaveBeenCalledWith('patient-search-appointments-form-workspace', {
      context: 'creating',
      patientUuid: 'patient-uuid',
      workspaceTitle: 'Crear nueva cita',
    });
  });

  it('offers appointment creation as the primary patient-search action', async () => {
    mockUserHasAccess.mockImplementation((privilege) => privilege === 'app:home.admision');
    render(<ScheduleAppointmentPrimaryAction patientUuid="patient-uuid" />);

    await userEvent.click(screen.getByRole('button', { name: /agregar cita/i }));

    expect(mockLaunchWorkspace2).toHaveBeenCalledWith('patient-search-appointments-form-workspace', {
      context: 'creating',
      patientUuid: 'patient-uuid',
      workspaceTitle: 'Crear nueva cita',
    });
  });

  it('keeps scheduling in the actions menu for clinical users', () => {
    mockUserHasAccess.mockReturnValue(false);

    render(<ScheduleAppointmentPrimaryAction patientUuid="patient-uuid" />);

    expect(screen.queryByRole('button', { name: /agregar cita/i })).not.toBeInTheDocument();
  });
});
