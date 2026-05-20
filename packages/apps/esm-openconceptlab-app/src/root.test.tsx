import { render, screen } from '@testing-library/react';

import Root from './root.component';

describe('Root component', () => {
  it('renders the title and tab containers', () => {
    renderOclSubscriptionModule();
    expect(screen.getByText('OCL Subscription Module')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Subscription' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Import' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Previous Imports' })).toBeInTheDocument();
  });
});

function renderOclSubscriptionModule() {
  render(<Root />);
}
