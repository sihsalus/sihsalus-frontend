import { render, screen } from '@testing-library/react';

import { type Appointment, AppointmentStatus } from '../types';

import PatientUpcomingAppointmentsCard from './patient-upcoming-appointments-card.component';
import { usePatientAppointments } from './patient-appointments.resource';

const mockUsePatientAppointments = vi.mocked(usePatientAppointments);

vi.mock('./patient-appointments.resource', async () => ({
  ...(await vi.importActual('./patient-appointments.resource')),
  usePatientAppointments: vi.fn(),
}));

const testProps = {
  patientUuid: 'test-patient-uuid',
  visitFormOpenedFrom: 'patient-chart',
  setVisitFormCallbacks: vi.fn(),
  patientChartConfig: { showUpcomingAppointments: true },
};

describe('PatientUpcomingAppointmentsCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUsePatientAppointments.mockReturnValue({
      data: { pastAppointments: [], upcomingAppointments: [], todaysAppointments: [] },
      error: null,
      isLoading: false,
      isValidating: false,
      mutate: vi.fn(),
    });
  });

  it('keeps the appointments search window stable across re-renders', () => {
    const { rerender } = render(<PatientUpcomingAppointmentsCard {...testProps} />);
    const [, firstStartDate] = mockUsePatientAppointments.mock.calls[0];

    rerender(<PatientUpcomingAppointmentsCard {...testProps} />);
    rerender(<PatientUpcomingAppointmentsCard {...testProps} />);

    // A startDate recomputed per render changes the SWR key each time, restarting the
    // request on every render and flooding the backend with appointments/search calls.
    for (const [, startDate] of mockUsePatientAppointments.mock.calls) {
      expect(startDate).toBe(firstStartDate);
    }
  });

  it('shows the professional assigned to each upcoming appointment', () => {
    const upcomingAppointment = {
      uuid: 'appointment-uuid',
      status: AppointmentStatus.SCHEDULED,
      startDateTime: '2026-08-03T09:00:00-05:00',
      service: { name: 'Medicina general' },
      providers: [{ display: 'Dra. Ana Torres', response: 'ACCEPTED' }],
    } as unknown as Appointment;
    mockUsePatientAppointments.mockReturnValue({
      data: { pastAppointments: [], upcomingAppointments: [upcomingAppointment], todaysAppointments: [] },
      error: null,
      isLoading: false,
      isValidating: false,
      mutate: vi.fn(),
    });

    render(<PatientUpcomingAppointmentsCard {...testProps} />);

    expect(screen.getByText('Responsible provider')).toBeInTheDocument();
    expect(screen.getByText('Dra. Ana Torres')).toBeInTheDocument();
  });

  it('renders a numeric appointment timestamp as the actual appointment date', () => {
    const upcomingAppointment = {
      uuid: 'appointment-uuid',
      status: AppointmentStatus.SCHEDULED,
      startDateTime: new Date('2026-08-10T09:00:00-05:00').getTime(),
      service: { name: 'Medicina general' },
      providers: [],
    } as unknown as Appointment;
    mockUsePatientAppointments.mockReturnValue({
      data: { pastAppointments: [], upcomingAppointments: [upcomingAppointment], todaysAppointments: [] },
      error: null,
      isLoading: false,
      isValidating: false,
      mutate: vi.fn(),
    });

    render(<PatientUpcomingAppointmentsCard {...testProps} />);

    expect(screen.getByText(/2026/)).toBeInTheDocument();
    expect(screen.queryByText(/1785/)).not.toBeInTheDocument();
  });
});
