import { render, screen } from '@testing-library/react';
import dayjs from 'dayjs';

import SelectedDateContext from '../../hooks/selectedDateContext';

import MonthlyWorkloadView from './monthly-workload-view.component';

vi.mock('./monthly-workload-view-expanded.component', () => ({
  default: ({ count }: { count: number }) => <button type="button">{count} more</button>,
}));

describe('MonthlyWorkloadView', () => {
  const appointmentDate = '2026-08-01';
  const longServiceName = 'Atención ambulatoria por médico especialista en medicina interna';
  const events = [
    {
      appointmentDate,
      services: [
        { serviceName: longServiceName, serviceUuid: 'service-one', count: 2 },
        { serviceName: 'Atención nutricional', serviceUuid: 'service-two', count: 1 },
        { serviceName: 'Ecografía general y Doppler', serviceUuid: 'service-three', count: 3 },
        { serviceName: 'Atención en farmacia clínica', serviceUuid: 'service-four', count: 1 },
      ],
    },
  ];

  it('keeps the complete service name accessible and limits crowded calendar cells', () => {
    render(
      <SelectedDateContext.Provider value={{ selectedDate: appointmentDate, setSelectedDate: vi.fn() }}>
        <MonthlyWorkloadView dateTime={dayjs(appointmentDate)} events={events} />
      </SelectedDateContext.Provider>,
    );

    expect(screen.getByRole('button', { name: `${longServiceName} (2)` })).toHaveTextContent(longServiceName);
    expect(screen.getByRole('button', { name: '1 more' })).toBeInTheDocument();
    expect(screen.queryByText('Atención en farmacia clínica')).not.toBeInTheDocument();
  });
});
