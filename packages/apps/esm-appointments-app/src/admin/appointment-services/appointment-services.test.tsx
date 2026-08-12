import { useLocations } from '@openmrs/esm-framework';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import AppointmentServices from './appointment-services.component';
import { useAppointmentServices } from './appointment-services-hook';

vi.mock('./appointment-services-hook');
vi.mock('../../hooks/useOverlay', () => ({ closeOverlay: vi.fn() }));

const mockUseAppointmentServices = vi.mocked(useAppointmentServices);
const mockUseLocations = vi.mocked(useLocations);

describe('AppointmentServices', () => {
  beforeEach(() => {
    mockUseLocations.mockReturnValue([]);
    mockUseAppointmentServices.mockReturnValue({
      addNewAppointmentService: vi.fn(),
      appointmentServiceInitialValue: {
        appointmentServiceId: 0,
        color: '',
        creatorName: '',
        description: '',
        durationMins: 0,
        endTime: '',
        endTimeTimeFormat: 'AM',
        initialAppointmentStatus: '',
        location: { display: '', uuid: '' },
        maxAppointmentsLimit: 0,
        name: '',
        startTime: '',
        startTimeTimeFormat: 'AM',
        uuid: '',
      },
    });
  });

  it('shows a controlled translated validation message for the service name', async () => {
    render(<AppointmentServices />);

    fireEvent.blur(screen.getByLabelText('Appointment service name'));

    await waitFor(() =>
      expect(screen.getByText('Appointment service name is required')).toBeInTheDocument(),
    );
  });
});
