import { useConfig } from '@openmrs/esm-framework';
import { screen } from '@testing-library/react';
import { renderWithSwr } from 'test-utils';

import AppointmentTabs from './appointment-tabs.component';

const mockUseConfig = vi.mocked(useConfig);

vi.mock('./scheduled/scheduled-appointments.component', () => ({
  default: () => <div>Scheduled appointments panel</div>,
}));

vi.mock('./unscheduled/unscheduled-appointments.component', () => ({
  default: () => <div>Unscheduled appointments panel</div>,
}));

describe('AppointmentTabs', () => {
  it(`renders tabs showing different appointment lists`, async () => {
    mockUseConfig.mockReturnValue({ showUnscheduledAppointmentsTab: true });

    renderWithSwr(<AppointmentTabs appointmentServiceTypes={['service-type-uuid']} />);

    const scheduledAppointmentsTab = screen.getByRole('tab', { name: /^scheduled$/i });
    const unsheduledAppointment = screen.getByRole('tab', { name: /^unscheduled$/i });

    expect(scheduledAppointmentsTab).toBeInTheDocument();
    expect(unsheduledAppointment).toBeInTheDocument();

    expect(scheduledAppointmentsTab).toHaveAttribute('aria-selected', 'true');
    expect(unsheduledAppointment).toHaveAttribute('aria-selected', 'false');

    expect(screen.getByText('Scheduled appointments panel')).toBeInTheDocument();
  });
});
