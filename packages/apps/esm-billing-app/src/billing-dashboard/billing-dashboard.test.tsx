import { render, screen } from '@testing-library/react';
import { BillingDashboard } from './billing-dashboard.component';

test('renders the billing dashboard', () => {
  renderBillingDashboard();

  expect(screen.getByTestId('billing-header')).toBeInTheDocument();
});

function renderBillingDashboard() {
  render(<BillingDashboard />);
}
