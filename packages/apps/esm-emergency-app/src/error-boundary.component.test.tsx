import { render, screen } from '@testing-library/react';

import ErrorBoundary from './error-boundary.component';

function FailingEmergencySection(): never {
  throw new Error('SQLSTATE 42P01 at /ws/rest/v1/queue-entry');
}

describe('Emergency error boundary', () => {
  it('does not expose the component exception to the operator', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <FailingEmergencySection />
      </ErrorBoundary>,
    );

    expect(
      screen.getByText(
        'No se pudo mostrar esta sección de emergencias. Reintente; si el problema continúa, recargue la página o contacte a soporte.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/SQLSTATE|\/ws\/rest/u)).not.toBeInTheDocument();
    expect(consoleError).toHaveBeenCalled();

    consoleError.mockRestore();
  });
});
