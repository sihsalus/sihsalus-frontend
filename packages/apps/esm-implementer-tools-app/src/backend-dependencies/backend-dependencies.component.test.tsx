import userEvent from '@testing-library/user-event';
import { render, screen } from '@testing-library/react';

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
});
