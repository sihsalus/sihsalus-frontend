import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { EmptyState } from '.';

describe('EmptyState', () => {
  it('renders an empty state widget card', () => {
    render(
      <EmptyState
        headerTitle="appointments"
        displayText="appointments"
        launchForm={vi.fn()}
      />,
    );

    expect(screen.getByRole('heading', { name: /appointments/i })).toBeInTheDocument();
    expect(screen.getByTitle(/empty data illustration/i)).toBeInTheDocument();
    expect(screen.getByText(/There are no appointments to display for this patient/i)).toBeInTheDocument();
  });

  it('renders a link that launches a form in the workspace when the launchForm prop is provided', async () => {
    const user = userEvent.setup();
    const launchForm = vi.fn();

    render(<EmptyState headerTitle="appointments" displayText="appointments" launchForm={launchForm} />);

    const recordAppointmentsLink = screen.getByText(/record appointments/i);
    expect(recordAppointmentsLink).toBeInTheDocument();

    await user.click(recordAppointmentsLink);

    expect(launchForm).toHaveBeenCalledTimes(1);
  });
});
