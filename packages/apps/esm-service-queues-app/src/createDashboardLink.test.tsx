import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';

import { createDashboardLink } from './createDashboardLink.component';

vi.mock('@openmrs/esm-framework', () => ({
  ConfigurableLink: ({ children, className, to }: { children: ReactNode; className?: string; to: string }) => (
    <a className={className} href={to}>
      {children}
    </a>
  ),
}));

describe('createDashboardLink', () => {
  it('renders the configured dashboard title instead of a hardcoded label', () => {
    window.history.pushState({}, '', '/openmrs/spa/home/service-queues');

    const DashboardLink = createDashboardLink({
      name: 'service-queues',
      title: 'careQueueDashboardTitle',
    });

    render(<DashboardLink />);

    const link = screen.getByRole('link', { name: /careQueueDashboardTitle/i });
    expect(link).toHaveAttribute('href', expect.stringContaining('/service-queues'));
    expect(link).toHaveClass('active-left-nav-link');
  });
});
