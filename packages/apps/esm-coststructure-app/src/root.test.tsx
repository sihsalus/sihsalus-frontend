import { render, screen } from '@testing-library/react';

import Root from './root.component';

vi.mock('./routes/router', () => ({
  Router: () => <div data-testid="cost-structure-router">Router</div>,
}));

it('renders the cost structure root component', () => {
  render(<Root />);
  expect(screen.getByTestId('cost-structure-router')).toBeInTheDocument();
});
