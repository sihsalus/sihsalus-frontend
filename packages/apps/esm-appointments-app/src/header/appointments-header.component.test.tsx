import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import SelectedDateContext from '../hooks/selectedDateContext';
import { useAppointmentServices } from '../hooks/useAppointmentService';
import type { AppointmentService } from '../types';
import AppointmentsHeader from './appointments-header.component';

vi.mock('../hooks/useAppointmentService');

const mockUseAppointmentServices = vi.mocked(useAppointmentServices);
const setSelectedDate = vi.fn();

const serviceTypes = [
  {
    appointmentServiceId: 1,
    creatorName: 'Admin',
    description: 'General medicine',
    endTime: '17:00',
    initialAppointmentStatus: 'Scheduled',
    maxAppointmentsLimit: null,
    name: 'General medicine',
    startTime: '08:00',
    uuid: 'service-one',
  },
  {
    appointmentServiceId: 2,
    creatorName: 'Admin',
    description: 'Pediatrics',
    endTime: '17:00',
    initialAppointmentStatus: 'Scheduled',
    maxAppointmentsLimit: null,
    name: 'Pediatrics',
    startTime: '08:00',
    uuid: 'service-two',
  },
] satisfies Array<AppointmentService>;

function renderAppointmentsHeader(props: Partial<React.ComponentProps<typeof AppointmentsHeader>> = {}) {
  return render(
    <SelectedDateContext.Provider value={{ selectedDate: '2026-07-15', setSelectedDate }}>
      <AppointmentsHeader title="Appointments" onChange={vi.fn()} {...props} />
    </SelectedDateContext.Provider>,
  );
}

describe('AppointmentsHeader', () => {
  beforeEach(() => {
    mockUseAppointmentServices.mockReturnValue({ serviceTypes, isLoading: false, error: undefined });
  });

  it('shows compact service and date filters in the expected reading order', () => {
    renderAppointmentsHeader();

    const header = screen.getByTestId('appointments-header');
    const serviceLabel = within(header).getByText('Service');
    const dateLabel = within(header).getByText('Date');

    expect(serviceLabel.compareDocumentPosition(dateLabel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(header).getByText('All')).toBeInTheDocument();
    expect(within(header).getByRole('combobox', { name: 'Service' })).toBeInTheDocument();
    expect(within(header).getByRole('textbox', { name: 'Date' })).toBeInTheDocument();
  });

  it('reports selected service UUIDs', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderAppointmentsHeader({ onChange });

    await user.click(screen.getByRole('combobox', { name: 'Service' }));
    await user.click(screen.getByText('Pediatrics'));

    expect(onChange).toHaveBeenLastCalledWith(['service-two']);
  });

  it('reflects service types selected by the parent', () => {
    renderAppointmentsHeader({ appointmentServiceTypes: ['service-two'] });

    expect(screen.getByTitle('1')).toHaveTextContent('1');
  });

  it('keeps the date filter when the service filter is not requested', () => {
    renderAppointmentsHeader({ onChange: undefined });

    const header = screen.getByTestId('appointments-header');
    expect(within(header).queryByText('Service')).not.toBeInTheDocument();
    expect(within(header).getByRole('textbox', { name: 'Date' })).toBeInTheDocument();
  });
});
