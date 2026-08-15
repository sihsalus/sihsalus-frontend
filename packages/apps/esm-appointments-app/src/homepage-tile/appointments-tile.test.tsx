import { render, screen } from '@testing-library/react';

import AppointmentsTile from './appointments-tile.component';
import useAppointmentsData from './appointments.resource';

vi.mock('./appointments.resource', () => ({
  default: vi.fn(),
}));

const mockUseAppointmentsData = vi.mocked(useAppointmentsData);

describe('AppointmentsTile', () => {
  it('links the daily count to the appointments dashboard', () => {
    mockUseAppointmentsData.mockReturnValue({
      data: [{ uuid: 'appointment-1' }, { uuid: 'appointment-2' }],
      error: undefined,
      isLoading: false,
    } as ReturnType<typeof useAppointmentsData>);

    render(<AppointmentsTile />);

    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Scheduled For Today/i })).toHaveAttribute(
      'href',
      `${globalThis.spaBase}/home/appointments`,
    );
  });
});
