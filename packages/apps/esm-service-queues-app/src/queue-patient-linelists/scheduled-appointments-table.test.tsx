import { getDefaultsFromConfigSchema, useConfig } from '@openmrs/esm-framework';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mockAppointmentsData } from 'test-utils';

import { type ConfigObject, configSchema } from '../config-schema';

import AppointmentsTable from './scheduled-appointments-table.component';

const mockUseConfig = vi.mocked(useConfig<ConfigObject>);
const mockUseAppointments = vi.hoisted(() => vi.fn());

vi.mock('./queue-linelist.resource', () => ({
  useAppointments: mockUseAppointments,
}));

describe('AppointmentsTable', () => {
  beforeEach(() => {
    mockUseAppointments.mockReturnValue({
      appointmentQueueEntries: mockAppointmentsData.data,
      isLoading: false,
    });
    mockUseConfig.mockReturnValue({
      ...getDefaultsFromConfigSchema(configSchema),
      appointmentStatuses: ['All', 'Scheduled', 'Completed'],
    });
  });

  it('renders appointments when loading is complete', () => {
    render(<AppointmentsTable />);

    const appointmentName = screen.getByText(/charles babbage/i);
    expect(appointmentName).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^filter$/i })).not.toBeInTheDocument();
  });

  it('filters appointments based on status selection', async () => {
    const user = userEvent.setup();
    render(<AppointmentsTable />);

    const statusDropdown = screen.getAllByLabelText('Status:');

    await user.type(statusDropdown[0], 'Completed');

    const filteredAppointmentName = screen.getByText(/charles babbage/i);
    expect(filteredAppointmentName).toBeInTheDocument();
  });

  it.each([undefined, null])('renders safely when appointment entries are %s', (appointmentQueueEntries) => {
    mockUseAppointments.mockReturnValue({
      appointmentQueueEntries,
      isLoading: false,
    });

    expect(() => render(<AppointmentsTable />)).not.toThrow();
  });

  it('keeps every appointment reachable when the result has more than one page', async () => {
    const user = userEvent.setup();
    const sampleAppointment = mockAppointmentsData.data[0];
    const appointments = Array.from({ length: 21 }, (_, index) => ({
      ...sampleAppointment,
      uuid: `appointment-${index + 1}`,
      patient: {
        ...sampleAppointment.patient,
        uuid: `patient-${index + 1}`,
        name: `Patient ${index + 1}`,
      },
    }));
    mockUseAppointments.mockReturnValue({ appointmentQueueEntries: appointments, isLoading: false });

    render(<AppointmentsTable />);

    expect(screen.queryByText('Patient 21')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /next page/i }));
    expect(screen.getByText('Patient 21')).toBeInTheDocument();
  });
});
