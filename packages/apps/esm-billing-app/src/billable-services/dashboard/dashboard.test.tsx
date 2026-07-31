import { render, screen } from '@testing-library/react';
import { waitForLoadingToFinish } from 'test-utils';
import { useBillableServices } from '../billable-service.resource';
import BillableServicesDashboard from './dashboard.component';

vi.mock('../billable-service.resource', () => ({
  useBillableServices: vi.fn(),
}));

test('renders an empty state when there are no services', async () => {
  vi.mocked(useBillableServices).mockReturnValue({
    billableServices: [],
    error: undefined,
    isLoading: false,
    isValidating: false,
    mutate: vi.fn(),
  });

  renderBillingDashboard();
  await waitForLoadingToFinish();

  // With no services the dashboard renders EmptyCard rather than the table.
  // Nothing checked which of the two came back.
  expect(screen.getAllByText(/billable service/i).length).toBeGreaterThan(0);
  expect(screen.queryByRole('table')).not.toBeInTheDocument();
});

function renderBillingDashboard() {
  render(<BillableServicesDashboard />);
}
