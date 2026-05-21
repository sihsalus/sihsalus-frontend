import { type FetchResponse, openmrsFetch } from '@openmrs/esm-framework';
import { render, screen } from '@testing-library/react';

import AppointmentsMetrics from './appointments-metrics.component';

const mockOpenmrsFetch = vi.mocked(openmrsFetch);

vi.mock('../hooks/useClinicalMetrics', async () => ({
  ...(await vi.importActual('../hooks/useClinicalMetrics')),
  useClinicalMetrics: vi.fn().mockReturnValue({
    highestServiceLoad: {
      serviceName: 'Outpatient',
      count: 4,
    },
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

describe('Appointment metrics', () => {
  it('should render metrics cards with the correct data', async () => {
    mockOpenmrsFetch.mockResolvedValueOnce({
      data: [],
    } as unknown as FetchResponse);

    render(<AppointmentsMetrics appointmentServiceTypes={['consultation-service-uuid']} />);

    await screen.findByText(/appointment metrics/i);
    expect(screen.getByText(/scheduled appointments/i)).toBeInTheDocument();
    expect(screen.getByText(/^appointments$/i)).toBeInTheDocument();
    expect(screen.getByText(/16/i)).toBeInTheDocument();
    expect(screen.getAllByText(/^4$/i)).toHaveLength(2);
  });
});
