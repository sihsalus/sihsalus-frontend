import { render, screen } from '@testing-library/react';
import dayjs from 'dayjs';

import { omrsDateFormat } from '../constants';
import SelectedDateContext from '../hooks/selectedDateContext';
import { useAppointmentList } from '../hooks/useAppointmentList';
import { useAllAppointmentsByDate, useClinicalMetrics, useScheduledAppointments } from '../hooks/useClinicalMetrics';
import { type Appointment, AppointmentStatus } from '../types';

import AppointmentsMetrics from './appointments-metrics.component';

const mockUseAppointmentList = vi.mocked(useAppointmentList);
const mockUseAllAppointmentsByDate = vi.mocked(useAllAppointmentsByDate);
const mockUseClinicalMetrics = vi.mocked(useClinicalMetrics);
const mockUseScheduledAppointments = vi.mocked(useScheduledAppointments);

vi.mock('../hooks/useClinicalMetrics', async () => ({
  ...(await vi.importActual('../hooks/useClinicalMetrics')),
  useClinicalMetrics: vi.fn().mockReturnValue({
    highestServiceLoad: {
      serviceName: 'Outpatient',
      count: 4,
    },
    missedAppointments: 5,
    isLoading: false,
    error: null,
  }),
  useAllAppointmentsByDate: vi.fn().mockReturnValue({
    totalProviders: 4,
    isLoading: false,
    error: null,
  }),
  useScheduledAppointments: vi.fn().mockReturnValue({
    totalScheduledAppointments: 16,
  }),
  useAppointmentDate: vi.fn().mockReturnValue({
    startDate: '2024-01-01',
  }),
}));

vi.mock('../hooks/useAppointmentList', () => ({
  useAppointmentList: vi.fn(),
}));

describe('Appointment metrics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAppointmentList.mockReturnValue({
      appointmentList: [],
      isLoading: false,
      error: null,
      mutate: vi.fn(),
    });
  });

  it('should render metrics cards with the correct data', async () => {
    render(<AppointmentsMetrics appointmentServiceTypes={['consultation-service-uuid']} />);

    await screen.findByText(/appointment metrics/i);
    expect(screen.getByText(/appointments scheduled today/i)).toBeInTheDocument();
    expect(screen.getByText(/^appointments$/i)).toBeInTheDocument();
    expect(screen.getByText(/16/i)).toBeInTheDocument();
    expect(screen.getAllByText(/^4$/i)).toHaveLength(2);
    expect(screen.getByText(/not arrived/i)).toBeInTheDocument();
    expect(screen.getByText(/^missed$/i)).toBeInTheDocument();
    expect(screen.getByText(/^5$/)).toBeInTheDocument();
    expect(mockUseClinicalMetrics).toHaveBeenCalledWith(['consultation-service-uuid']);
    expect(mockUseAllAppointmentsByDate).toHaveBeenCalledWith(['consultation-service-uuid']);
    expect(mockUseScheduledAppointments).toHaveBeenCalledWith(['consultation-service-uuid']);
  });

  it('keeps the not-arrived label for past dates instead of relabeling still-scheduled appointments as missed', () => {
    const pastDate = dayjs().subtract(2, 'day').startOf('day').format(omrsDateFormat);

    render(
      <SelectedDateContext.Provider value={{ selectedDate: pastDate, setSelectedDate: vi.fn() }}>
        <AppointmentsMetrics appointmentServiceTypes={[]} />
      </SelectedDateContext.Provider>,
    );

    // Regression: the scheduled count used to be relabeled "Missed" for past dates even though the
    // appointments were still Scheduled in the backend. The missed column now carries the real count.
    expect(screen.getByText(/not arrived/i)).toBeInTheDocument();
    expect(screen.getByText(/^missed$/i)).toBeInTheDocument();
    expect(screen.getByText(/^5$/)).toBeInTheDocument();
  });

  it('does not treat the empty service selection as an active filter for the status breakdown', () => {
    const createAppointment = (uuid: string, serviceUuid: string, status: AppointmentStatus) =>
      ({
        uuid,
        status,
        service: { uuid: serviceUuid },
      }) as Appointment;
    mockUseAppointmentList.mockImplementation((status) => ({
      appointmentList: [
        createAppointment(`${status}-service-a`, 'service-a', status as AppointmentStatus),
        createAppointment(`${status}-service-b`, 'service-b', status as AppointmentStatus),
      ],
      isLoading: false,
      error: null,
      mutate: vi.fn(),
    }));

    render(<AppointmentsMetrics appointmentServiceTypes={[]} />);

    expect(screen.getAllByText(/^2$/)).toHaveLength(2);
  });
});
