import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Appointments from './appointments.component';

describe('Appointments', () => {
  it('renders the appointments dashboard', async () => {
    render(
      <MemoryRouter>
        <Appointments />
      </MemoryRouter>,
    );

    // Awaiting the combobox only proved the dashboard finished rendering. It is
    // the service filter, and that it opens on "All" is what callers depend on:
    // a different default would silently scope the whole dashboard.
    const serviceFilter = await screen.findByRole('combobox');
    expect(serviceFilter).toHaveTextContent(/all/i);

    expect(screen.getByRole('button', { name: /appointments calendar/i })).toBeInTheDocument();
    expect(screen.getByDisplayValue(/\d{2}\/\d{2}\/\d{4}/)).toBeInTheDocument();
    expect(within(screen.getByTestId('appointments-header')).getByText(/^service$/i)).toBeInTheDocument();
    expect(within(screen.getByTestId('appointments-header')).getByText(/^date$/i)).toBeInTheDocument();
    expect(screen.getByText(/appointment metrics/i)).toBeInTheDocument();
    expect(screen.getByText(/appointments scheduled today/i)).toBeInTheDocument();
    expect(screen.getByText(/highest volume service/i)).toBeInTheDocument();
    expect(screen.getByText(/providers booked/i)).toBeInTheDocument();
  });
});
