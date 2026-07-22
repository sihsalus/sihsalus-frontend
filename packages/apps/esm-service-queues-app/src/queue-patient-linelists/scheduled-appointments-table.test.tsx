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
});
