import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { BackendDependencies } from './backend-dependencies.component';

describe('BackendDependencies', () => {
  it('shows tailored authentication feedback and exposes a manual retry action', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();

    render(
      <BackendDependencies
        backendDependencies={[]}
        error="Server responded with 401"
        errorStatus={401}
        onRetry={onRetry}
      />,
    );

    expect(screen.getByText(/authentication required/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /retry/i }));

    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('shows safe recovery guidance without exposing the technical gateway error', () => {
    render(
      <BackendDependencies
        backendDependencies={[]}
        error="Failed to fetch backend modules: Server responded with 503"
        errorStatus={503}
      />,
    );

    expect(screen.getByText('The check could not be completed')).toBeInTheDocument();
    expect(
      screen.getByText('The service is temporarily unavailable. Check your connection and try again.'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/server responded with 503/i)).not.toBeInTheDocument();
  });
});
