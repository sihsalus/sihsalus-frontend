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

    await screen.findByRole('combobox');

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
